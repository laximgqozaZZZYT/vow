#!/usr/bin/env python3
"""
Supabase AuthからCognitoへユーザーを移行するスクリプト

Usage:
    python migrate_users.py

Environment Variables:
    SUPABASE_CONNECTION_STRING: Supabase PostgreSQL connection string
    COGNITO_USER_POOL_ID: Cognito User Pool ID
    AWS_REGION: AWS region (default: ap-northeast-1)
"""

import asyncio
import json
import os
import sys
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

try:
    import asyncpg
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install asyncpg boto3")
    sys.exit(1)


@dataclass
class UserMigrationResult:
    """ユーザー移行結果"""
    user_id: str
    email: str
    success: bool
    action: str  # "created", "skipped", "failed"
    error: Optional[str] = None


@dataclass
class MigrationReport:
    """移行レポート"""
    timestamp: str
    total: int
    success: int
    skipped: int
    failed: int
    results: List[UserMigrationResult] = field(default_factory=list)


class UserMigrator:
    """ユーザー移行クラス"""

    def __init__(
        self,
        supabase_conn_string: str,
        cognito_user_pool_id: str,
        region: str = "ap-northeast-1"
    ):
        self.supabase_conn_string = supabase_conn_string
        self.cognito_client = boto3.client("cognito-idp", region_name=region)
        self.user_pool_id = cognito_user_pool_id

    async def migrate_all(self, dry_run: bool = False) -> MigrationReport:
        """全ユーザーを移行"""
        print("=" * 60)
        print("VOW User Migration: Supabase Auth → Cognito")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        print(f"Dry run: {dry_run}")
        print()

        conn = await asyncpg.connect(self.supabase_conn_string)

        results: List[UserMigrationResult] = []
        success_count = 0
        skipped_count = 0
        failed_count = 0

        try:
            # Supabase auth.usersテーブルからユーザー取得
            users = await conn.fetch("""
                SELECT 
                    id,
                    email,
                    raw_user_meta_data,
                    created_at,
                    app_metadata,
                    email_confirmed_at
                FROM auth.users
                WHERE email IS NOT NULL
                ORDER BY created_at
            """)

            total = len(users)
            print(f"Found {total} users to migrate")
            print()

            for i, user in enumerate(users, 1):
                email = user["email"]
                user_id = str(user["id"])

                print(f"[{i}/{total}] Processing: {email}...", end=" ")

                try:
                    # 既存ユーザーチェック
                    if self._user_exists(email):
                        skipped_count += 1
                        results.append(UserMigrationResult(
                            user_id=user_id,
                            email=email,
                            success=True,
                            action="skipped"
                        ))
                        print("⏭️  Skipped (already exists)")
                        continue

                    if dry_run:
                        success_count += 1
                        results.append(UserMigrationResult(
                            user_id=user_id,
                            email=email,
                            success=True,
                            action="dry_run"
                        ))
                        print("🔍 Would create (dry run)")
                        continue

                    # Cognitoにユーザー作成
                    self._create_cognito_user(user)
                    success_count += 1
                    results.append(UserMigrationResult(
                        user_id=user_id,
                        email=email,
                        success=True,
                        action="created"
                    ))
                    print("✅ Created")

                except Exception as e:
                    failed_count += 1
                    results.append(UserMigrationResult(
                        user_id=user_id,
                        email=email,
                        success=False,
                        action="failed",
                        error=str(e)
                    ))
                    print(f"❌ Failed: {e}")

        finally:
            await conn.close()

        print()
        print("=" * 60)
        print("Summary")
        print("=" * 60)
        print(f"Total users: {total}")
        print(f"Created: {success_count}")
        print(f"Skipped: {skipped_count}")
        print(f"Failed: {failed_count}")

        if failed_count > 0:
            print("\nFailed users:")
            for result in results:
                if result.action == "failed":
                    print(f"  - {result.email}: {result.error}")

        return MigrationReport(
            timestamp=datetime.now().isoformat(),
            total=total,
            success=success_count,
            skipped=skipped_count,
            failed=failed_count,
            results=results
        )

    def _user_exists(self, email: str) -> bool:
        """Cognitoにユーザーが存在するかチェック"""
        try:
            self.cognito_client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=email
            )
            return True
        except self.cognito_client.exceptions.UserNotFoundException:
            return False

    def _create_cognito_user(self, user: dict) -> None:
        """Cognitoにユーザーを作成"""
        meta = user.get("raw_user_meta_data") or {}
        app_meta = user.get("app_metadata") or {}

        # 基本属性
        attributes = [
            {"Name": "email", "Value": user["email"]},
            {"Name": "email_verified", "Value": "true" if user.get("email_confirmed_at") else "false"},
        ]

        # カスタム属性: Supabase ID（元のUUIDを保持）
        attributes.append({
            "Name": "custom:supabase_id",
            "Value": str(user["id"])
        })

        # 名前（あれば）
        if meta.get("full_name"):
            attributes.append({"Name": "name", "Value": meta["full_name"]})
        elif meta.get("name"):
            attributes.append({"Name": "name", "Value": meta["name"]})

        # 作成日時
        if user.get("created_at"):
            attributes.append({
                "Name": "custom:created_at",
                "Value": user["created_at"].isoformat()
            })

        # 認証プロバイダー
        if app_meta.get("provider"):
            attributes.append({
                "Name": "custom:auth_provider",
                "Value": app_meta["provider"]
            })

        # Cognitoにユーザー作成
        # MessageAction="SUPPRESS" でウェルカムメールを送信しない
        self.cognito_client.admin_create_user(
            UserPoolId=self.user_pool_id,
            Username=user["email"],
            UserAttributes=attributes,
            MessageAction="SUPPRESS"
        )

        # メール確認済みの場合、ユーザーを確認済みに設定
        if user.get("email_confirmed_at"):
            self.cognito_client.admin_update_user_attributes(
                UserPoolId=self.user_pool_id,
                Username=user["email"],
                UserAttributes=[
                    {"Name": "email_verified", "Value": "true"}
                ]
            )


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate users from Supabase to Cognito")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run without creating users"
    )
    args = parser.parse_args()

    # 環境変数から設定を取得
    supabase_conn = os.environ.get("SUPABASE_CONNECTION_STRING")
    cognito_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
    region = os.environ.get("AWS_REGION", "ap-northeast-1")

    if not supabase_conn:
        print("Error: SUPABASE_CONNECTION_STRING environment variable is required")
        print("Example: postgresql://postgres:password@db.xxx.supabase.co:5432/postgres")
        sys.exit(1)

    if not cognito_pool_id:
        print("Error: COGNITO_USER_POOL_ID environment variable is required")
        print("Example: ap-northeast-1_XXXXXXXXX")
        sys.exit(1)

    migrator = UserMigrator(
        supabase_conn_string=supabase_conn,
        cognito_user_pool_id=cognito_pool_id,
        region=region
    )

    report = asyncio.run(migrator.migrate_all(dry_run=args.dry_run))

    # 終了コード
    sys.exit(0 if report.failed == 0 else 1)


if __name__ == "__main__":
    main()
