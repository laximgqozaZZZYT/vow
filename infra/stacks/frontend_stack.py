"""
Amplify Hosting Stack for VOW Frontend

Next.jsフロントエンドをAWS Amplify Hostingでホスティングするスタック。
"""

from aws_cdk import (
    Stack,
    CfnOutput,
    RemovalPolicy,
    aws_amplify as amplify,
    aws_iam as iam,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct
from typing import Optional


class FrontendStack(Stack):
    """Amplify Hosting Stack for Next.js Frontend"""
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        github_owner: str,
        github_repo: str,
        github_branch: str = "main",
        api_gateway_url: str,
        cognito_user_pool_id: str,
        cognito_client_id: str,
        cognito_domain: str,
        github_token_secret_name: Optional[str] = None,
        custom_domain: Optional[str] = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        
        # GitHub Personal Access Token (Secrets Manager)
        if github_token_secret_name:
            github_token = secretsmanager.Secret.from_secret_name_v2(
                self, "GitHubToken",
                secret_name=github_token_secret_name
            )
        
        # Amplify App
        self.amplify_app = amplify.CfnApp(
            self, "VowAmplifyApp",
            name="vow-app",
            description="VOW - Habit Tracking Application",
            
            # GitHub連携
            repository=f"https://github.com/{github_owner}/{github_repo}",
            oauth_token=github_token.secret_value.unsafe_unwrap() if github_token_secret_name else None,
            
            # ビルド設定
            build_spec=self._get_build_spec(),
            
            # 環境変数
            environment_variables=[
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_API_URL",
                    value=api_gateway_url
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_COGNITO_USER_POOL_ID",
                    value=cognito_user_pool_id
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_COGNITO_CLIENT_ID",
                    value=cognito_client_id
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_COGNITO_DOMAIN",
                    value=cognito_domain
                ),
                amplify.CfnApp.EnvironmentVariableProperty(
                    name="NEXT_PUBLIC_AUTH_PROVIDER",
                    value="cognito"
                ),
            ],
            
            # プラットフォーム設定
            platform="WEB_COMPUTE",  # Next.js SSR対応
            
            # 自動ブランチ作成
            enable_branch_auto_build=True,
            
            # カスタムルール（リダイレクト）
            custom_rules=[
                amplify.CfnApp.CustomRuleProperty(
                    source="/<*>",
                    target="/index.html",
                    status="404-200"
                ),
                # API プロキシ（オプション）
                amplify.CfnApp.CustomRuleProperty(
                    source="/api/<*>",
                    target=f"{api_gateway_url}/<*>",
                    status="200"
                ),
            ],
        )
        
        # Main Branch
        self.main_branch = amplify.CfnBranch(
            self, "MainBranch",
            app_id=self.amplify_app.attr_app_id,
            branch_name=github_branch,
            
            # 自動ビルド有効
            enable_auto_build=True,
            
            # ステージ設定
            stage="PRODUCTION",
            
            # 環境変数（ブランチ固有）
            environment_variables=[
                amplify.CfnBranch.EnvironmentVariableProperty(
                    name="NODE_ENV",
                    value="production"
                ),
            ],
        )
        
        # カスタムドメイン（オプション）
        if custom_domain:
            self.domain = amplify.CfnDomain(
                self, "CustomDomain",
                app_id=self.amplify_app.attr_app_id,
                domain_name=custom_domain,
                sub_domain_settings=[
                    amplify.CfnDomain.SubDomainSettingProperty(
                        branch_name=github_branch,
                        prefix=""  # apex domain
                    ),
                    amplify.CfnDomain.SubDomainSettingProperty(
                        branch_name=github_branch,
                        prefix="www"
                    ),
                ],
            )
        
        # Outputs
        CfnOutput(
            self, "AmplifyAppId",
            value=self.amplify_app.attr_app_id,
            description="Amplify App ID"
        )
        
        CfnOutput(
            self, "AmplifyAppUrl",
            value=f"https://{github_branch}.{self.amplify_app.attr_default_domain}",
            description="Amplify App URL"
        )
        
        if custom_domain:
            CfnOutput(
                self, "CustomDomainUrl",
                value=f"https://{custom_domain}",
                description="Custom Domain URL"
            )
    
    def _get_build_spec(self) -> str:
        """Amplify Build Spec for Next.js"""
        return """
version: 1
applications:
  - frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci --legacy-peer-deps
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/.next
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
          - frontend/.next/cache/**/*
    appRoot: frontend
"""
