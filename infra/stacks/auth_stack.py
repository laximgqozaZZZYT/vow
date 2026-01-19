"""
AuthStack - Amazon Cognito for Production Authentication

This stack creates:
- Cognito User Pool with OAuth support
- Google OAuth Identity Provider
- GitHub OAuth Identity Provider (OIDC)
- App Client for web application
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_cognito as cognito,
    aws_ssm as ssm,
)
from constructs import Construct


class AuthStack(Stack):
    """
    CDK Stack for Cognito Authentication.
    
    Creates a Cognito User Pool with Google and GitHub OAuth
    support for production authentication.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        domain_prefix: str = "vow-auth",
        callback_urls: list = None,
        logout_urls: list = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # Default URLs
        if callback_urls is None:
            callback_urls = [
                "https://your-domain.com/auth/callback",
                "http://localhost:3000/auth/callback",
            ]
        if logout_urls is None:
            logout_urls = [
                "https://your-domain.com",
                "http://localhost:3000",
            ]

        # =================================================================
        # Cognito User Pool
        # =================================================================
        self.user_pool = cognito.UserPool(
            self,
            "UserPool",
            user_pool_name="vow-production-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(
                email=True,
                username=False,
            ),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(required=True, mutable=True),
                fullname=cognito.StandardAttribute(required=False, mutable=True),
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=False,
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # =================================================================
        # Google Identity Provider
        # Note: O