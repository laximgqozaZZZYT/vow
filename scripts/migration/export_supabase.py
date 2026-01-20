#!/usr/bin/env python3
"""
Supabaseからデータをエクスポートするスクリプト

Usage:
    python export_supabase.py --output ./export_data

Environment Variables:
    SUPABASE_CONNECTION_STRING: Supabase PostgreSQL connection string
"""

import asyncio
import json
import hashlib
import os
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

try:
    import asyncpg
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install asyncpg")
    sys.exit(1)


@dataclass
class ExportResult:
    """エクスポート結果"""
    table_name: str
    row_count: int
    checksum: str
    exported_at: str


@dataclass
class ExportMetadata:
    """エクスポートメタデータ"""
    exported_at: str
    source: str
    tables: List[ExportResult]
    total_rows: int


class JSONEncoder(json.JSONEncoder):
    """カスタムJSONエンコーダー"""
    
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        return super().default(obj)


class SupabaseExporter:
    """Supabaseデータエクスポーター"""
    
    # エクスポート対象テーブル（依存関係順）
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
    
    def __init__(self, connection_string: str, output_dir: str):
        self.connection_string = connection_string
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    async def export_all(self) -> ExportMetadata:
        """全テーブルをエクスポート"""
        print("=" * 60)
        print("Supabase Data Export")
        print("=" * 60)
        print(f"Output directory: {self.output_dir}")
        print(f"Started at: {datetime.now().isoformat()}")
        print()
        
        conn = await asyncpg.connect(self.connection_string)
        results: List[ExportResult] = []
        total_rows = 0
        
        try:
            for table in self.TABLES:
                print(f"Exporting {table}...", end=" ")
                
                try:
                    # テーブル存在確認
                    exists = await self._table_exists(conn, table)
                    if not exists:
                        print("⏭️  SKIPPED (table not found)")
                        continue
                    
                    # データエクスポート
                    data = await self._export_table(conn, table)
                    checksum = self._calculate_checksum(data)
                    
                    # JSONファイルに保存
                    output_file = self.output_dir / f"{table}.json"
                    with open(output_file, "w", encoding="utf-8") as f:
                        json.dump(data, f, cls=JSONEncoder, ensure_ascii=False, indent=2)
                    
                    result = ExportResult(
                        table_name=table,
                        row_count=len(data),
                        checksum=checksum,
                        exported_at=datetime.now().isoformat()
                    )
                    results.append(result)
                    total_rows += len(data)
                    
                    print(f"✅ {len(data)} rows (checksum: {checksum[:8]}...)")
                    
                except Exception as e:
                    print(f"❌ ERROR: {e}")
                    
        finally:
            await conn.close()
        
        # メタデータ保存
        metadata = ExportMetadata(
            exported_at=datetime.now().isoformat(),
            source="supabase",
            tables=results,
            total_rows=total_rows
        )
        
        metadata_file = self.output_dir / "metadata.json"
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(asdict(metadata), f, indent=2)
        
        print()
        print("=" * 60)
        print("Export Summary")
        print("=" * 60)
        print(f"Tables exported: {len(results)}")
        print(f"Total rows: {total_rows}")
        print(f"Output directory: {self.output_dir}")
        print()
        print("✅ Export completed successfully!")
        
        return metadata
    
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
    
    async def _export_table(self, conn, table: str) -> List[Dict[str, Any]]:
        """テーブルデータをエクスポート"""
        rows = await conn.fetch(f"SELECT * FROM {table} ORDER BY id")
        return [dict(row) for row in rows]
    
    def _calculate_checksum(self, data: List[Dict[str, Any]]) -> str:
        """データのチェックサムを計算"""
        content = json.dumps(data, sort_keys=True, cls=JSONEncoder)
        return hashlib.sha256(content.encode()).hexdigest()


async def export_users(connection_string: str, output_dir: Path) -> int:
    """auth.usersテーブルをエクスポート（Cognito移行用）"""
    print("Exporting auth.users for Cognito migration...", end=" ")
    
    conn = await asyncpg.connect(connection_string)
    
    try:
        # Supabase auth.usersテーブルからユーザー情報を取得
        rows = await conn.fetch("""
            SELECT 
                id,
                email,
                raw_user_meta_data,
                raw_app_meta_data,
                created_at,
                updated_at,
                last_sign_in_at
            FROM auth.users
            ORDER BY created_at
        """)
        
        users = []
        for row in rows:
            user = dict(row)
            # メタデータをパース
            if user.get('raw_user_meta_data'):
                user['user_metadata'] = user.pop('raw_user_meta_data')
            if user.get('raw_app_meta_data'):
                user['app_metadata'] = user.pop('raw_app_meta_data')
            users.append(user)
        
        # JSONファイルに保存
        output_file = output_dir / "auth_users.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(users, f, cls=JSONEncoder, ensure_ascii=False, indent=2)
        
        print(f"✅ {len(users)} users")
        return len(users)
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return 0
    finally:
        await conn.close()


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description="Export data from Supabase PostgreSQL"
    )
    parser.add_argument(
        "--output", "-o",
        default="./export_data",
        help="Output directory for exported data"
    )
    parser.add_argument(
        "--include-users",
        action="store_true",
        help="Include auth.users table for Cognito migration"
    )
    args = parser.parse_args()
    
    # 環境変数から接続文字列を取得
    conn_string = os.environ.get("SUPABASE_CONNECTION_STRING")
    
    if not conn_string:
        print("Error: SUPABASE_CONNECTION_STRING environment variable is required")
        print("Example: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres")
        sys.exit(1)
    
    output_dir = Path(args.output)
    
    # データエクスポート
    exporter = SupabaseExporter(conn_string, str(output_dir))
    asyncio.run(exporter.export_all())
    
    # ユーザーエクスポート（オプション）
    if args.include_users:
        print()
        asyncio.run(export_users(conn_string, output_dir))


if __name__ == "__main__":
    main()
