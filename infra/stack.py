"""
VowDevStack - AWS CDK Stack for Development Environment

This stack creates:
- AWS Amplify Hosting for Next.js SSR application
- GitHub integration for automatic deployments

Usage:
  cdk deploy -c github_repo="https://github.com/USERNAME/REPO" \
             -c supabase_url="https://xxx.supabase.co" \
             -c supabase_anon_key="eyJ..."
"""

from aws_cdk import (
    Stack,
    CfnOutput,
    SecretValue,
    aws_amplify as amplify,
    aws_iam as iam,
)
from constructs import Construct


class VowDevStack(Stack):
    """
    CDK Stack for Vow Development Environment.
    
    Deploys AWS Amplify Hosting with GitHub integration for
    automatic deployments of the Next.js SSR application.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # =================================================================
        # Configuration from CDK Context
        # =================================================================
        # GitHub repository URL (required for deploy, use placeholder for destroy/synth)
        github_repo = self.node.try_get_context("github_repo") or "https://github.com/PLACEHOLDER/REPO"
        
        # Environment variables (can be set via context or Amplify Console)
        supabase_url = self.node.try_get_context("supabase_url") or "SET_IN_AMPLIFY_CONSOLE"
        supabase_anon_key = self.node.try_get_context("supabase_anon_key") or "SET_IN_AMPLIFY_CONSOLE"

        # =================================================================
        # IAM Service Role for Amplify
        # =================================================================
        amplify_service_role = iam.Role(
            self,
            "AmplifyServiceRole",
            assumed_by=iam.ServicePrincipal("amplify.amazonaws.com"),
            description="Service role for Amplify Hosting",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "AdministratorAccess-Amplify"
                ),
            ],
        )

        # =================================================================
        # Amplify App (using L1 CfnApp for full control)
        # =================================================================
        amplify_app = amplify.CfnApp(
            self,
            "VowDevApp",
            name="vow-dev",
            description="Vow Habit Tracking App - Development Environment",
            # GitHub repository configuration
            repository=github_repo,
            oauth_token=SecretValue.secrets_manager(
                "github-token",
                json_field="token",
            ).unsafe_unwrap(),
            # Platform: WEB_COMPUTE for Next.js SSR
            platform="WEB_COMPUTE",
            # IAM service role
            iam_service_role=amplify_service_role.role_arn,
            # Build specification - Note: amplify.yml in repo takes precedence
            # This is a fallback if amplify.yml is not present
            build_spec="""
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
""",
            # Environment variables
            environment_variables=[
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="AMPLIFY_MONOREPO_APP_ROOT",
                    value="frontend",
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_SUPABASE_URL",
                    value=supabase_url,
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_SUPABASE_ANON_KEY",
                    value=supabase_anon_key,
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_USE_SUPABASE_API",
                    value="true",
                ),
            ],
            # Enable branch auto-deletion
            enable_branch_auto_deletion=True,
            # Custom rules for SPA routing
            custom_rules=[
                amplify.CfnApp.CustomRuleProperty(
                    source="/<*>",
                    target="/index.html",
                    status="404-200",
                ),
            ],
        )

        # =================================================================
        # Branch Configuration (develop branch)
        # =================================================================
        develop_branch = amplify.CfnBranch(
            self,
            "DevelopBranch",
            app_id=amplify_app.attr_app_id,
            branch_name="develop",
            description="Development branch with auto-deploy",
            # Enable auto-build on push
            enable_auto_build=True,
            # Stage: DEVELOPMENT
            stage="DEVELOPMENT",
            # Framework: Next.js SSR
            framework="Next.js - SSR",
            # Environment variables specific to this branch (set dynamically)
            environment_variables=[
                amplify.CfnBranch.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_SITE_URL",
                    value=f"https://develop.{amplify_app.attr_app_id}.amplifyapp.com",
                ),
            ],
        )

        # =================================================================
        # Outputs
        # =================================================================
        CfnOutput(
            self,
            "AmplifyAppId",
            value=amplify_app.attr_app_id,
            description="Amplify App ID",
        )

        CfnOutput(
            self,
            "AmplifyAppUrl",
            value=f"https://develop.{amplify_app.attr_app_id}.amplifyapp.com",
            description="Amplify App URL (develop branch)",
        )

        CfnOutput(
            self,
            "AmplifyConsoleUrl",
            value=f"https://{self.region}.console.aws.amazon.com/amplify/home?region={self.region}#/{amplify_app.attr_app_id}",
            description="Amplify Console URL",
        )
