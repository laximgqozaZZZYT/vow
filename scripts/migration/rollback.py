#!/usr/bin/env python3
"""
VOW Production Migration Rollback Controller

AWSからVercel/Supabaseへのロールバックを制御するスクリプト。
DNS切り戻し、検証ステップ、通知機能を提供。

Usage:
    python rollback.py --dry-run
    python rollback.py --execute

Environment Variables:
    AWS_REGION: AWS region (default: ap-northeast-1)
    SNS_TOPIC_ARN: SNS topic for notifications
    VERCEL_TOKEN: Vercel API token (optional)
    SUPABASE_URL: Supabase project URL
"""

import asyncio
import json
import os
import sys
import argparse
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install boto3")
    sys.exit(1)

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class RollbackStep(Enum):
    """ロールバックステップ"""
    PRE_CHECK = "pre_check"
    STOP_DMS = "stop_dms"
    UPDATE_DNS = "update_dns"
    VERIFY_VERCEL = "verify_vercel"
    VERIFY_SUPABASE = "verify_supabase"
    NOTIFY = "notify"
    POST_CHECK = "post_check"


@dataclass
class StepResult:
    """ステップ実行結果"""
    step: RollbackStep
    success: bool
    message: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class RollbackReport:
    """ロールバックレポート"""
    timestamp: str
    dry_run: bool
    success: bool
    steps: List[StepResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class RollbackController:
    """ロールバックコントローラー"""
    
    def __init__(
        self,
        region: str = "ap-northeast-1",
        sns_topic_arn: Optional[str] = None,
        vercel_token: Optional[str] = None,
        supabase_url: Optional[str] = None
    ):
        self.region = region
        self.sns_topic_arn = sns_topic_arn
        self.vercel_token = vercel_token
        self.supabase_url = supabase_url
        
        # AWS clients
        self.dms_client = boto3.client("dms", region_name=region)
        self.sns_client = boto3.client("sns", region_name=region)
        self.route53_client = boto3.client("route53")
    
    async def execute(self, dry_run: bool = True) -> RollbackReport:
        """ロールバックを実行"""
        print("=" * 60)
        print("VOW Production Migration Rollback")
        print("=" * 60)
        print(f"Started at: {datetime.now().isoformat()}")
        print(f"Dry run: {dry_run}")
        print()
        
        report = RollbackReport(
            timestamp=datetime.now().isoformat(),
            dry_run=dry_run,
            success=True
        )
        
        # Step 1: Pre-check
        result = await self._pre_check()
        report.steps.append(result)
        if not result.success:
            report.success = False
            report.errors.append(f"Pre-check failed: {result.message}")
            return report
        
        # Step 2: Stop DMS
        result = await self._stop_dms(dry_run)
        report.steps.append(result)
        
        # Step 3: Update DNS (if applicable)
        result = await self._update_dns(dry_run)
        report.steps.append(result)
        
        # Step 4: Verify Vercel
        result = await self._verify_vercel()
        report.steps.append(result)
        if not result.success:
            report.errors.append(f"Vercel verification failed: {result.message}")
        
        # Step 5: Verify Supabase
        result = await self._verify_supabase()
        report.steps.append(result)
        if not result.success:
            report.errors.append(f"Supabase verification failed: {result.message}")
        
        # Step 6: Send notification
        result = await self._send_notification(dry_run, report)
        report.steps.append(result)
        
        # Step 7: Post-check
        result = await self._post_check()
        report.steps.append(result)
        
        # Summary
        print()
        print("=" * 60)
        print("Rollback Summary")
        print("=" * 60)
        
        for step in report.steps:
            status = "✅" if step.success else "❌"
            print(f"{status} {step.step.value}: {step.message}")
        
        if report.errors:
            print()
            print("Errors:")
            for error in report.errors:
                print(f"  - {error}")
        
        print()
        if dry_run:
            print("🔍 This was a DRY RUN - no changes were made")
        
        report.success = len(report.errors) == 0
        return report
    
    async def _pre_check(self) -> StepResult:
        """事前チェック"""
        print("Step 1: Pre-check...")
        
        checks = []
        
        # AWS credentials
        try:
            sts = boto3.client("sts")
            identity = sts.get_caller_identity()
            checks.append(f"AWS Account: {identity['Account']}")
        except Exception as e:
            return StepResult(
                step=RollbackStep.PRE_CHECK,
                success=False,
                message=f"AWS credentials invalid: {e}"
            )
        
        # Vercel token (optional)
        if self.vercel_token:
            checks.append("Vercel token: configured")
        else:
            checks.append("Vercel token: not configured (manual steps required)")
        
        # Supabase URL
        if self.supabase_url:
            checks.append(f"Supabase URL: {self.supabase_url}")
        else:
            checks.append("Supabase URL: not configured")
        
        print(f"  ✅ Pre-check passed")
        return StepResult(
            step=RollbackStep.PRE_CHECK,
            success=True,
            message="All pre-checks passed",
            details={"checks": checks}
        )
    
    async def _stop_dms(self, dry_run: bool) -> StepResult:
        """DMS レプリケーションを停止"""
        print("Step 2: Stop DMS replication...")
        
        try:
            # DMS タスクを検索
            response = self.dms_client.describe_replication_tasks(
                Filters=[
                    {"Name": "replication-task-id", "Values": ["vow-*"]}
                ]
            )
            
            tasks = response.get("ReplicationTasks", [])
            
            if not tasks:
                print("  ⏭️  No DMS tasks found")
                return StepResult(
                    step=RollbackStep.STOP_DMS,
                    success=True,
                    message="No DMS tasks found"
                )
            
            stopped_tasks = []
            for task in tasks:
                task_arn = task["ReplicationTaskArn"]
                task_status = task["Status"]
                
                if task_status == "running":
                    if dry_run:
                        print(f"  🔍 Would stop: {task_arn}")
                    else:
                        self.dms_client.stop_replication_task(
                            ReplicationTaskArn=task_arn
                        )
                        print(f"  ✅ Stopped: {task_arn}")
                    stopped_tasks.append(task_arn)
                else:
                    print(f"  ⏭️  Task not running ({task_status}): {task_arn}")
            
            return StepResult(
                step=RollbackStep.STOP_DMS,
                success=True,
                message=f"Stopped {len(stopped_tasks)} DMS tasks",
                details={"stopped_tasks": stopped_tasks}
            )
            
        except ClientError as e:
            print(f"  ⚠️  DMS error: {e}")
            return StepResult(
                step=RollbackStep.STOP_DMS,
                success=True,  # Non-critical
                message=f"DMS check skipped: {e}"
            )
    
    async def _update_dns(self, dry_run: bool) -> StepResult:
        """DNS を更新（Route53）"""
        print("Step 3: Update DNS...")
        
        # Note: This is a placeholder. In production, you would:
        # 1. Get the hosted zone ID
        # 2. Update the A/CNAME record to point to Vercel
        
        print("  ℹ️  DNS update requires manual configuration")
        print("  Instructions:")
        print("    1. Go to Route53 console (if using Route53)")
        print("    2. Update A/CNAME record to point to Vercel")
        print("    3. Or update your DNS provider settings")
        
        return StepResult(
            step=RollbackStep.UPDATE_DNS,
            success=True,
            message="DNS update instructions provided (manual step)"
        )
    
    async def _verify_vercel(self) -> StepResult:
        """Vercel デプロイメントを検証"""
        print("Step 4: Verify Vercel...")
        
        if not HAS_HTTPX:
            print("  ⚠️  httpx not installed, skipping HTTP check")
            return StepResult(
                step=RollbackStep.VERIFY_VERCEL,
                success=True,
                message="Skipped (httpx not installed)"
            )
        
        vercel_url = "https://vow-sigma.vercel.app"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(vercel_url, timeout=10.0)
                
                if response.status_code == 200:
                    print(f"  ✅ Vercel responding: {vercel_url}")
                    return StepResult(
                        step=RollbackStep.VERIFY_VERCEL,
                        success=True,
                        message=f"Vercel responding (status: {response.status_code})",
                        details={"url": vercel_url, "status": response.status_code}
                    )
                else:
                    print(f"  ⚠️  Vercel returned status {response.status_code}")
                    return StepResult(
                        step=RollbackStep.VERIFY_VERCEL,
                        success=False,
                        message=f"Vercel returned status {response.status_code}"
                    )
                    
        except Exception as e:
            print(f"  ❌ Vercel check failed: {e}")
            return StepResult(
                step=RollbackStep.VERIFY_VERCEL,
                success=False,
                message=f"Vercel check failed: {e}"
            )
    
    async def _verify_supabase(self) -> StepResult:
        """Supabase を検証"""
        print("Step 5: Verify Supabase...")
        
        if not self.supabase_url:
            print("  ⚠️  Supabase URL not configured")
            return StepResult(
                step=RollbackStep.VERIFY_SUPABASE,
                success=True,
                message="Skipped (URL not configured)"
            )
        
        if not HAS_HTTPX:
            print("  ⚠️  httpx not installed, skipping HTTP check")
            return StepResult(
                step=RollbackStep.VERIFY_SUPABASE,
                success=True,
                message="Skipped (httpx not installed)"
            )
        
        try:
            # Supabase health check endpoint
            health_url = f"{self.supabase_url}/rest/v1/"
            
            async with httpx.AsyncClient() as client:
                response = await client.get(health_url, timeout=10.0)
                
                # Supabase returns 401 without auth, but that means it's responding
                if response.status_code in [200, 401]:
                    print(f"  ✅ Supabase responding: {self.supabase_url}")
                    return StepResult(
                        step=RollbackStep.VERIFY_SUPABASE,
                        success=True,
                        message="Supabase responding",
                        details={"url": self.supabase_url}
                    )
                else:
                    return StepResult(
                        step=RollbackStep.VERIFY_SUPABASE,
                        success=False,
                        message=f"Supabase returned status {response.status_code}"
                    )
                    
        except Exception as e:
            print(f"  ❌ Supabase check failed: {e}")
            return StepResult(
                step=RollbackStep.VERIFY_SUPABASE,
                success=False,
                message=f"Supabase check failed: {e}"
            )
    
    async def _send_notification(
        self,
        dry_run: bool,
        report: RollbackReport
    ) -> StepResult:
        """通知を送信"""
        print("Step 6: Send notification...")
        
        if not self.sns_topic_arn:
            print("  ⏭️  SNS topic not configured")
            return StepResult(
                step=RollbackStep.NOTIFY,
                success=True,
                message="Skipped (SNS topic not configured)"
            )
        
        message = f"""
VOW Production Rollback Report
==============================
Timestamp: {report.timestamp}
Dry Run: {report.dry_run}

Steps:
"""
        for step in report.steps:
            status = "✅" if step.success else "❌"
            message += f"  {status} {step.step.value}: {step.message}\n"
        
        if report.errors:
            message += "\nErrors:\n"
            for error in report.errors:
                message += f"  - {error}\n"
        
        if dry_run:
            print(f"  🔍 Would send notification to: {self.sns_topic_arn}")
            return StepResult(
                step=RollbackStep.NOTIFY,
                success=True,
                message="Notification would be sent (dry run)"
            )
        
        try:
            self.sns_client.publish(
                TopicArn=self.sns_topic_arn,
                Subject="[VOW] Production Rollback Report",
                Message=message
            )
            print(f"  ✅ Notification sent")
            return StepResult(
                step=RollbackStep.NOTIFY,
                success=True,
                message="Notification sent"
            )
        except Exception as e:
            print(f"  ⚠️  Notification failed: {e}")
            return StepResult(
                step=RollbackStep.NOTIFY,
                success=True,  # Non-critical
                message=f"Notification failed: {e}"
            )
    
    async def _post_check(self) -> StepResult:
        """事後チェック"""
        print("Step 7: Post-check...")
        
        checklist = [
            "Verify Vercel deployment is serving traffic",
            "Verify Supabase database is accessible",
            "Test Google OAuth login on Vercel",
            "Test GitHub OAuth login on Vercel",
            "Monitor error rates in Vercel dashboard",
            "Update status page (if applicable)",
        ]
        
        print("  Manual verification checklist:")
        for item in checklist:
            print(f"    [ ] {item}")
        
        return StepResult(
            step=RollbackStep.POST_CHECK,
            success=True,
            message="Post-check checklist provided",
            details={"checklist": checklist}
        )


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description="VOW Production Migration Rollback Controller"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Perform a dry run (default)"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually execute the rollback"
    )
    args = parser.parse_args()
    
    dry_run = not args.execute
    
    # 環境変数
    region = os.environ.get("AWS_REGION", "ap-northeast-1")
    sns_topic_arn = os.environ.get("SNS_TOPIC_ARN")
    vercel_token = os.environ.get("VERCEL_TOKEN")
    supabase_url = os.environ.get("SUPABASE_URL")
    
    controller = RollbackController(
        region=region,
        sns_topic_arn=sns_topic_arn,
        vercel_token=vercel_token,
        supabase_url=supabase_url
    )
    
    report = asyncio.run(controller.execute(dry_run=dry_run))
    
    # 終了コード
    sys.exit(0 if report.success else 1)


if __name__ == "__main__":
    main()
