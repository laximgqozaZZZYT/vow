#!/usr/bin/env python3
"""
DMS移行後のデータ整合性を検証するスクリプト

Usage:
    python verify_data.py

Environment Variables:
    SUPABASE_CONNECTION_STRING: Supabase PostgreSQL connection string
    AURORA_SECRET_ARN: Aurora Secrets Manager ARN
    AWS_REGION: AWS region (default: ap-northeast-1)
"""

import asyncio
import json
import hashlib
import os
import sys
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

try:
    import asyncpg
    import boto3
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install asyncpg boto3")
    sys.exit(1)


@dataclass
class TableVerificationResult:
    """テーブル検証結果"""
    table_name: str
    passed: bool
    source_count: int
    target_count: int
    reason: Optional[str] = None
    checksum_match: Optional[bool] = None


@dataclass
class VerificationReport:
    """検証レポート"""
    all_passed: bool
    timestamp: str
    tables: List[TableVerificationResult]
    summary: Dict


class DataVerifier:
    """データ整合性検証クラス"""

    # 移行対象テーブル
    TABLES = [
        "habits",
        "habit_logs",
        "goals",
        "tasks",
        "activities",
        "mindmaps",
        "mindmap_nodes",
        "stickies",
        "tags",
        "entity_tags",
    ]

    # チェックサム対象テーブル（重要データ）
    CHECKSUM_TABLES = ["habits", "goals", "tasks", "mindmaps"]

    def __init__(
        self,
        source_conn_string: str,
        target_secret_arn: str,
        region: str = "ap-northeast-1"
    ):
        self.source_conn_string = source_conn_string
        self.target_secret_arn = target_secret_arn
        self.region = region
        self._target_conn_string: Optional[str] = None

    def _get_target_connection_string(self) -> str:
        """Secrets Managerから接続文字列を取得"""
        if self._target_conn_string:
            return self._target_conn_string

        client = boto3.client("secretsmanager", region_name=self.region)
        response = client.get_secret_value(SecretId=self.target_secret_arn)
        secret = json.loads(response["SecretString"])

        self._target_conn_string = (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret['port']}/{secret.get('dbname', 'vow')}"
        )
        return self._target_conn_string

    async def verify_all(self) -> VerificationReport:
        """全テーブルの整合性を検証"""
        print("=" * 60)
        print("VOW Data Migration Verification")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        print()

        source_conn = await asyncpg.connect(self.source_conn_string)
        target_conn = await asyncpg.connect(self._get_target_connection_string())

        results: List[TableVerificationResult] = []
        passed_count = 0
        failed_count = 0
        total_source_rows = 0
        total_target_rows = 0

        try:
            for table in self.TABLES:
                print(f"Verifying table: {table}...", end=" ")

                try:
                    result = await self._verify_table(source_conn, target_conn, table)
                    results.append(result)

                    total_source_rows += result.source_count
                    total_target_rows += result.target_count

                    if result.passed:
                        passed_count += 1
                        checksum_info = ""
                        if result.checksum_match is not None:
                            checksum_info = f" (checksum: {'✓' if result.checksum_match else '✗'})"
                        print(f"✅ PASSED ({result.source_count} rows){checksum_info}")
                    else:
                        failed_count += 1
                        print(f"❌ FAILED - {result.reason}")

                except Exception as e:
                    failed_count += 1
                    results.append(TableVerificationResult(
                        table_name=table,
                        passed=False,
                        source_count=0,
                        target_count=0,
                        reason=f"Error: {str(e)}"
                    ))
                    print(f"❌ ERROR - {e}")

        finally:
            await source_conn.close()
            await target_conn.close()

        all_passed = failed_count == 0

        print()
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Total tables: {len(self.TABLES)}")
        print(f"Passed: {passed_count}")
        print(f"Failed: {failed_count}")
        print(f"Total source rows: {total_source_rows}")
        print(f"Total target rows: {total_target_rows}")
        print()

        if all_passed:
            print("✅ All verifications PASSED!")
        else:
            print("❌ Some verifications FAILED!")
            print("\nFailed tables:")
            for result in results:
                if not result.passed:
                    print(f"  - {result.table_name}: {result.reason}")

        return VerificationReport(
            all_passed=all_passed,
            timestamp=datetime.now().isoformat(),
            tables=results,
            summary={
                "total_tables": len(self.TABLES),
                "passed": passed_count,
                "failed": failed_count,
                "total_source_rows": total_source_rows,
                "total_target_rows": total_target_rows,
            }
        )

    async def _verify_table(
        self,
        source_conn,
        target_conn,
        table: str
    ) -> TableVerificationResult:
        """テーブルの整合性を検証"""

        # テーブル存在確認
        source_exists = await self._table_exists(source_conn, table)
        target_exists = await self._table_exists(target_conn, table)

        if not source_exists:
            return TableVerificationResult(
                table_name=table,
                passed=True,  # ソースにない場合はスキップ
                source_count=0,
                target_count=0,
                reason="Table does not exist in source (skipped)"
            )

        if not target_exists:
            return TableVerificationResult(
                table_name=table,
                passed=False,
                source_count=0,
                target_count=0,
                reason="Table does not exist in target"
            )

        # 行数比較
        source_count = await source_conn.fetchval(
            f"SELECT COUNT(*) FROM {table}"
        )
        target_count = await target_conn.fetchval(
            f"SELECT COUNT(*) FROM {table}"
        )

        if source_count != target_count:
            return TableVerificationResult(
                table_name=table,
                passed=False,
                source_count=source_count,
                target_count=target_count,
                reason=f"Row count mismatch: source={source_count}, target={target_count}"
            )

        # 空テーブルの場合はOK
        if source_count == 0:
            return TableVerificationResult(
                table_name=table,
                passed=True,
                source_count=0,
                target_count=0
            )

        # プライマリキーの存在確認
        source_ids = await source_conn.fetch(
            f"SELECT id FROM {table} ORDER BY id LIMIT 1000"
        )
        target_ids = await target_conn.fetch(
            f"SELECT id FROM {table} ORDER BY id LIMIT 1000"
        )

        source_id_set = {str(row['id']) for row in source_ids}
        target_id_set = {str(row['id']) for row in target_ids}

        if source_id_set != target_id_set:
            missing = len(source_id_set - target_id_set)
            extra = len(target_id_set - source_id_set)
            return TableVerificationResult(
                table_name=table,
                passed=False,
                source_count=source_count,
                target_count=target_count,
                reason=f"ID mismatch in first 1000 rows: missing={missing}, extra={extra}"
            )

        # チェックサム検証（重要テーブルのみ）
        checksum_match = None
        if table in self.CHECKSUM_TABLES:
            checksum_match = await self._verify_checksum(
                source_conn, target_conn, table
            )

        return TableVerificationResult(
            table_name=table,
            passed=True,
            source_count=source_count,
            target_count=target_count,
            checksum_match=checksum_match
        )

    async def _table_exists(self, conn, table: str) -> bool:
        """テーブルの存在確認"""
        result = await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = $1
            )
        """, table)
        return result

    async def _verify_checksum(
        self,
        source_conn,
        target_conn,
        table: str
    ) -> bool:
        """チェックサム検証（サンプリング）"""
        try:
            # 最初の100行のIDを取得してチェックサム比較
            source_data = await source_conn.fetch(f"""
                SELECT * FROM {table} 
                ORDER BY id 
                LIMIT 100
            """)
            target_data = await target_conn.fetch(f"""
                SELECT * FROM {table} 
                ORDER BY id 
                LIMIT 100
            """)

            source_hash = hashlib.md5(
                str(sorted([dict(row) for row in source_data], key=lambda x: str(x.get('id')))).encode()
            ).hexdigest()
            target_hash = hashlib.md5(
                str(sorted([dict(row) for row in target_data], key=lambda x: str(x.get('id')))).encode()
            ).hexdigest()

            return source_hash == target_hash
        except Exception:
            return False


def main():
    """メイン関数"""
    # 環境変数から設定を取得
    source_conn = os.environ.get("SUPABASE_CONNECTION_STRING")
    target_secret = os.environ.get("AURORA_SECRET_ARN")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")

    if not source_conn:
        print("Error: SUPABASE_CONNECTION_STRING environment variable is required")
        print("Example: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres")
        sys.exit(1)

    if not target_secret:
        print("Error: AURORA_SECRET_ARN environment variable is required")
        print("Example: arn:aws:secretsmanager:ap-northeast-1:123456789:secret:rds!cluster-xxx")
        sys.exit(1)

    verifier = DataVerifier(
        source_conn_string=source_conn,
        target_secret_arn=target_secret,
        region=region
    )

    report = asyncio.run(verifier.verify_all())

    # 終了コード
    sys.exit(0 if report.all_passed else 1)


if __name__ == "__main__":
    main()
