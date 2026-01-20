#!/usr/bin/env python3
"""
SupabaseからAuroraへの増分同期スクリプト

移行期間中にSupabaseで発生した変更をAuroraに同期します。
タイムスタンプベースの追跡とlast-write-winsコンフリクト解決を使用。

Usage:
    python sync_incremental.py --since "2026-01-19T00:00:00"
    python sync_incremental.py --state ./sync_state.json

Environment Variables:
    SUPABASE_CONNECTION_STRING: Supabase PostgreSQL connection string
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
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from uuid import UUID

try:
    import asyncpg
    import boto3
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install asyncpg boto3")
    sys.exit(1)


@dataclass
class SyncState:
    """同期状態"""
    last_sync: str
    tables: Dict[str, str]  # table_name -> last_updated_at


@dataclass
class SyncResult:
    """同期結果"""
    table_name: str
    inserted: int
    updated: int
    deleted: int
    errors: int


class JSONEncoder(json.JSONEncoder):
    """カスタムJSONエンコーダー"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        return super().default(obj)


class IncrementalSyncer:
    """増分同期クラス"""
    
    # 同期対象テーブル（updated_atカラムを持つもの）
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
    
    # バッチサイズ
    BATCH_SIZE = 100
    
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
    
    async def sync(
        self,
        since: Optional[datetime] = None,
        state_file: Optional[Path] = None,
        dry_run: bool = False
    ) -> List[SyncResult]:
        """増分同期を実行"""
        print("=" * 60)
        print("VOW Incremental Sync: Supabase → Aurora")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        print(f"Dry run: {dry_run}")
        print()
        
        # 同期状態の読み込み
        state = self._load_state(state_file)
        if since:
            sync_since = since
        elif state:
            sync_since = datetime.fromisoformat(state.last_sync)
        else:
            # デフォルト: 24時間前
            sync_since = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
        
        print(f"Syncing changes since: {sync_since.isoformat()}")
        print()
        
        source_conn = await asyncpg.connect(self.source_conn_string)
        target_conn = await asyncpg.connect(self._get_target_connection_string())
        
        results: List[SyncResult] = []
        new_state = SyncState(
            last_sync=datetime.now(timezone.utc).isoformat(),
            tables={}
        )
        
        try:
            for table in self.TABLES:
                print(f"Syncing {table}...", end=" ")
                
                try:
                    # テーブル存在確認
                    if not await self._table_exists(source_conn, table):
                        print("⏭️  SKIPPED (not found)")
                        continue
                    
                    # updated_atカラム確認
                    has_updated_at = await self._has_column(
                        source_conn, table, "updated_at"
                    )
                    
                    result = await self._sync_table(
                        source_conn,
                        target_conn,
                        table,
                        sync_since if has_updated_at else None,
                        dry_run
                    )
                    results.append(result)
                    
                    # 状態更新
                    if has_updated_at:
                        max_updated = await source_conn.fetchval(
                            f"SELECT MAX(updated_at) FROM {table}"
                        )
                        if max_updated:
                            new_state.tables[table] = max_updated.isoformat()
                    
                    status = "🔍" if dry_run else "✅"
                    print(f"{status} +{result.inserted} ~{result.updated} -{result.deleted}")
                    
                except Exception as e:
                    results.append(SyncResult(
                        table_name=table,
                        inserted=0,
                        updated=0,
                        deleted=0,
                        errors=1
                    ))
                    print(f"❌ ERROR: {e}")
        
        finally:
            await source_conn.close()
            await target_conn.close()
        
        # 状態の保存
        if state_file and not dry_run:
            self._save_state(state_file, new_state)
        
        # サマリー
        total_inserted = sum(r.inserted for r in results)
        total_updated = sum(r.updated for r in results)
        total_deleted = sum(r.deleted for r in results)
        total_errors = sum(r.errors for r in results)
        
        print()
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Tables synced: {len(results)}")
        print(f"Total inserted: {total_inserted}")
        print(f"Total updated: {total_updated}")
        print(f"Total deleted: {total_deleted}")
        print(f"Total errors: {total_errors}")
        
        if dry_run:
            print()
            print("🔍 This was a DRY RUN - no data was actually synced")
        
        return results
    
    async def _sync_table(
        self,
        source_conn,
        target_conn,
        table: str,
        since: Optional[datetime],
        dry_run: bool
    ) -> SyncResult:
        """テーブルの増分同期"""
        inserted = 0
        updated = 0
        deleted = 0
        errors = 0
        
        # 変更されたレコードを取得
        if since:
            query = f"""
                SELECT * FROM {table}
                WHERE updated_at > $1
                ORDER BY updated_at
            """
            rows = await source_conn.fetch(query, since)
        else:
            # updated_atがない場合は全件
            rows = await source_conn.fetch(f"SELECT * FROM {table}")
        
        if not rows:
            return SyncResult(table, 0, 0, 0, 0)
        
        # カラム情報
        columns = list(rows[0].keys())
        
        for row in rows:
            try:
                row_dict = dict(row)
                row_id = row_dict.get("id")
                
                if dry_run:
                    # dry-runの場合は存在チェックのみ
                    exists = await self._record_exists(target_conn, table, row_id)
                    if exists:
                        updated += 1
                    else:
                        inserted += 1
                    continue
                
                # UPSERT（last-write-wins）
                result = await self._upsert_record(
                    target_conn, table, columns, row_dict
                )
                
                if result == "inserted":
                    inserted += 1
                elif result == "updated":
                    updated += 1
                    
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"\n  Warning: {e}")
        
        # 削除されたレコードの同期（オプション）
        if since:
            deleted = await self._sync_deletions(
                source_conn, target_conn, table, since, dry_run
            )
        
        return SyncResult(table, inserted, updated, deleted, errors)
    
    async def _upsert_record(
        self,
        conn,
        table: str,
        columns: List[str],
        row: Dict[str, Any]
    ) -> str:
        """レコードをUPSERT"""
        placeholders = ", ".join([f"${i+1}" for i in range(len(columns))])
        column_names = ", ".join(columns)
        update_set = ", ".join([
            f"{col} = EXCLUDED.{col}"
            for col in columns
            if col != "id"
        ])
        
        # 既存レコードの確認
        exists = await self._record_exists(conn, table, row.get("id"))
        
        query = f"""
            INSERT INTO {table} ({column_names})
            VALUES ({placeholders})
            ON CONFLICT (id) DO UPDATE SET {update_set}
        """
        
        values = [self._convert_value(row.get(col)) for col in columns]
        await conn.execute(query, *values)
        
        return "updated" if exists else "inserted"
    
    async def _sync_deletions(
        self,
        source_conn,
        target_conn,
        table: str,
        since: datetime,
        dry_run: bool
    ) -> int:
        """削除されたレコードを同期"""
        # ソースに存在しないがターゲットに存在するIDを検出
        # 注: これは大規模データでは非効率なので、
        # 本番では削除フラグやイベントログを使用することを推奨
        
        # サンプル実装: 最近更新されたIDのみチェック
        target_ids = await target_conn.fetch(f"""
            SELECT id FROM {table}
            WHERE updated_at > $1
            LIMIT 1000
        """, since)
        
        if not target_ids:
            return 0
        
        deleted = 0
        for row in target_ids:
            target_id = row["id"]
            exists_in_source = await self._record_exists(
                source_conn, table, target_id
            )
            
            if not exists_in_source:
                if not dry_run:
                    await target_conn.execute(
                        f"DELETE FROM {table} WHERE id = $1",
                        target_id
                    )
                deleted += 1
        
        return deleted
    
    async def _table_exists(self, conn, table: str) -> bool:
        """テーブル存在確認"""
        return await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )
        """, table)
    
    async def _has_column(self, conn, table: str, column: str) -> bool:
        """カラム存在確認"""
        return await conn.fetchval("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                AND column_name = $2
            )
        """, table, column)
    
    async def _record_exists(self, conn, table: str, record_id) -> bool:
        """レコード存在確認"""
        if record_id is None:
            return False
        return await conn.fetchval(
            f"SELECT EXISTS (SELECT 1 FROM {table} WHERE id = $1)",
            record_id
        )
    
    def _convert_value(self, value: Any) -> Any:
        """値をPostgreSQL互換形式に変換"""
        if value is None:
            return None
        if isinstance(value, dict):
            return json.dumps(value)
        if isinstance(value, list):
            return json.dumps(value)
        return value
    
    def _load_state(self, state_file: Optional[Path]) -> Optional[SyncState]:
        """同期状態を読み込み"""
        if not state_file or not state_file.exists():
            return None
        
        with open(state_file) as f:
            data = json.load(f)
        
        return SyncState(
            last_sync=data.get("last_sync", ""),
            tables=data.get("tables", {})
        )
    
    def _save_state(self, state_file: Path, state: SyncState) -> None:
        """同期状態を保存"""
        state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(state_file, "w") as f:
            json.dump(asdict(state), f, indent=2)
        print(f"\nState saved to: {state_file}")


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description="Incremental sync from Supabase to Aurora"
    )
    parser.add_argument(
        "--since",
        help="Sync changes since this timestamp (ISO format)"
    )
    parser.add_argument(
        "--state",
        help="State file path for tracking sync progress"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run without syncing data"
    )
    args = parser.parse_args()
    
    # 環境変数
    source_conn = os.environ.get("SUPABASE_CONNECTION_STRING")
    target_secret = os.environ.get("AURORA_SECRET_ARN")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    
    if not source_conn:
        print("Error: SUPABASE_CONNECTION_STRING is required")
        sys.exit(1)
    
    if not target_secret:
        print("Error: AURORA_SECRET_ARN is required")
        sys.exit(1)
    
    # パラメータ
    since = None
    if args.since:
        since = datetime.fromisoformat(args.since)
    
    state_file = None
    if args.state:
        state_file = Path(args.state)
    
    # 同期実行
    syncer = IncrementalSyncer(
        source_conn_string=source_conn,
        target_secret_arn=target_secret,
        region=region
    )
    
    results = asyncio.run(syncer.sync(
        since=since,
        state_file=state_file,
        dry_run=args.dry_run
    ))
    
    # エラーがあれば終了コード1
    has_errors = any(r.errors > 0 for r in results)
    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()
