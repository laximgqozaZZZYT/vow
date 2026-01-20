#!/usr/bin/env python3
"""
Aurora Serverless v2にデータをインポートするスクリプト

Usage:
    python import_aurora.py --input ./export_data

Environment Variables:
    AURORA_SECRET_ARN: Aurora Secrets Manager ARN
    AWS_REGION: AWS region (default: ap-northeast-1)
"""

import asyncio
import json
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

try:
    import asyncpg
    import boto3
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install asyncpg boto3")
    sys.exit(1)


@dataclass
class ImportResult:
    """インポート結果"""
    table_name: str
    imported_count: int
    skipped_count: int
    error_count: int
    success: bool
    error_message: Optional[str] = None


class AuroraImporter:
    """Auroraデータインポーター"""
    
    # インポート対象テーブル（依存関係順）
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
        "slack_connections",
        "slack_follow_up_status",
    ]
    
    # バッチサイズ
    BATCH_SIZE = 100
    
    def __init__(
        self,
        secret_arn: str,
        input_dir: str,
        region: str = "ap-northeast-1"
    ):
        self.secret_arn = secret_arn
        self.input_dir = Path(input_dir)
        self.region = region
        self._conn_string: Optional[str] = None
    
    def _get_connection_string(self) -> str:
        """Secrets Managerから接続文字列を取得"""
        if self._conn_string:
            return self._conn_string
        
        client = boto3.client("secretsmanager", region_name=self.region)
        response = client.get_secret_value(SecretId=self.secret_arn)
        secret = json.loads(response["SecretString"])
        
        self._conn_string = (
            f"postgresql://{secret['username']}:{secret['password']}"
            f"@{secret['host']}:{secret['port']}/{secret.get('dbname', 'vow')}"
        )
        return self._conn_string
    
    async def import_all(self, dry_run: bool = False) -> List[ImportResult]:
        """全テーブルをインポート"""
        print("=" * 60)
        print("Aurora Data Import")
        print("=" * 60)
        print(f"Input directory: {self.input_dir}")
        print(f"Dry run: {dry_run}")
        print(f"Started at: {datetime.now().isoformat()}")
        print()
        
        # メタデータ読み込み
        metadata_file = self.input_dir / "metadata.json"
        if not metadata_file.exists():
            print("Error: metadata.json not found in input directory")
            sys.exit(1)
        
        with open(metadata_file) as f:
            metadata = json.load(f)
        
        print(f"Source export: {metadata.get('exported_at', 'unknown')}")
        print(f"Total rows in export: {metadata.get('total_rows', 'unknown')}")
        print()
        
        conn = await asyncpg.connect(self._get_connection_string())
        results: List[ImportResult] = []
        total_imported = 0
        total_errors = 0
        
        try:
            for table in self.TABLES:
                input_file = self.input_dir / f"{table}.json"
                
                if not input_file.exists():
                    print(f"Importing {table}... ⏭️  SKIPPED (file not found)")
                    continue
                
                print(f"Importing {table}...", end=" ")
                
                try:
                    result = await self._import_table(conn, table, input_file, dry_run)
                    results.append(result)
                    
                    if result.success:
                        total_imported += result.imported_count
                        status = "✅"
                        if dry_run:
                            status = "🔍"
                        print(f"{status} {result.imported_count} rows imported, {result.skipped_count} skipped")
                    else:
                        total_errors += result.error_count
                        print(f"❌ ERROR: {result.error_message}")
                        
                except Exception as e:
                    total_errors += 1
                    results.append(ImportResult(
                        table_name=table,
                        imported_count=0,
                        skipped_count=0,
                        error_count=1,
                        success=False,
                        error_message=str(e)
                    ))
                    print(f"❌ ERROR: {e}")
                    
        finally:
            await conn.close()
        
        print()
        print("=" * 60)
        print("Import Summary")
        print("=" * 60)
        print(f"Tables processed: {len(results)}")
        print(f"Total rows imported: {total_imported}")
        print(f"Total errors: {total_errors}")
        
        if dry_run:
            print()
            print("🔍 This was a DRY RUN - no data was actually imported")
        
        if total_errors == 0:
            print()
            print("✅ Import completed successfully!")
        else:
            print()
            print("⚠️  Import completed with errors")
        
        return results
    
    async def _import_table(
        self,
        conn,
        table: str,
        input_file: Path,
        dry_run: bool
    ) -> ImportResult:
        """テーブルデータをインポート"""
        with open(input_file, encoding="utf-8") as f:
            data = json.load(f)
        
        if not data:
            return ImportResult(
                table_name=table,
                imported_count=0,
                skipped_count=0,
                error_count=0,
                success=True
            )
        
        # カラム情報を取得
        columns = list(data[0].keys())
        
        imported_count = 0
        skipped_count = 0
        error_count = 0
        
        # バッチ処理
        for i in range(0, len(data), self.BATCH_SIZE):
            batch = data[i:i + self.BATCH_SIZE]
            
            for row in batch:
                try:
                    if dry_run:
                        imported_count += 1
                        continue
                    
                    # UPSERT（ON CONFLICT DO UPDATE）
                    placeholders = ", ".join([f"${j+1}" for j in range(len(columns))])
                    column_names = ", ".join(columns)
                    update_set = ", ".join([
                        f"{col} = EXCLUDED.{col}" 
                        for col in columns 
                        if col != "id"
                    ])
                    
                    query = f"""
                        INSERT INTO {table} ({column_names})
                        VALUES ({placeholders})
                        ON CONFLICT (id) DO UPDATE SET {update_set}
                    """
                    
                    values = [self._convert_value(row.get(col)) for col in columns]
                    await conn.execute(query, *values)
                    imported_count += 1
                    
                except asyncpg.UniqueViolationError:
                    skipped_count += 1
                except Exception as e:
                    error_count += 1
                    if error_count <= 5:  # 最初の5件のエラーのみログ
                        print(f"\n  Warning: Error importing row: {e}")
        
        return ImportResult(
            table_name=table,
            imported_count=imported_count,
            skipped_count=skipped_count,
            error_count=error_count,
            success=error_count == 0
        )
    
    def _convert_value(self, value: Any) -> Any:
        """値をPostgreSQL互換形式に変換"""
        if value is None:
            return None
        if isinstance(value, str):
            # UUID文字列の場合はそのまま
            try:
                UUID(value)
                return value
            except (ValueError, TypeError):
                pass
            # ISO日時文字列の場合はそのまま
            return value
        if isinstance(value, dict):
            return json.dumps(value)
        if isinstance(value, list):
            return json.dumps(value)
        return value


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description="Import data to Aurora Serverless v2"
    )
    parser.add_argument(
        "--input", "-i",
        default="./export_data",
        help="Input directory containing exported data"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run without actually importing data"
    )
    args = parser.parse_args()
    
    # 環境変数から設定を取得
    secret_arn = os.environ.get("AURORA_SECRET_ARN")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    
    if not secret_arn:
        print("Error: AURORA_SECRET_ARN environment variable is required")
        print("Example: arn:aws:secretsmanager:ap-northeast-1:123456789:secret:rds!cluster-xxx")
        sys.exit(1)
    
    # データインポート
    importer = AuroraImporter(
        secret_arn=secret_arn,
        input_dir=args.input,
        region=region
    )
    
    results = asyncio.run(importer.import_all(dry_run=args.dry_run))
    
    # エラーがあれば終了コード1
    has_errors = any(not r.success for r in results)
    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
