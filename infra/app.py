#!/usr/bin/env python3
"""
AWS CDK App Entry Point for Vow Development Environment

This CDK app deploys the development infrastructure for the Vow habit tracking
application:
- AWS Amplify Hosting for Next.js frontend
- AWS App Runner for FastAPI backend
- Amazon RDS PostgreSQL for database
"""

import aws_cdk as cdk
from stack import VowDevStack
from stacks.database_stack import DatabaseStack
from stacks.backend_stack import BackendStack


def main():
    """Main entry point for CDK app."""
    app = cdk.App()

    # Environment configuration
    env = cdk.Environment(
        region="ap-northeast-1",  # Tokyo region for low latency
    )

    # =================================================================
    # Frontend Stack (Amplify Hosting)
    # =================================================================
    frontend_stack = VowDevStack(
        app,
        "VowDevStack",
        env=env,
        description="Vow App Development Environment - Amplify Hosting",
    )

    # =================================================================
    # Database Stack (RDS PostgreSQL)
    # =================================================================
    # Only deploy if backend is enabled via context
    deploy_backend = app.node.try_get_context("deploy_backend") == "true"
    
    if deploy_backend:
        database_stack = DatabaseStack(
            app,
            "VowDatabaseStack",
            env=env,
            description="Vow App Database - RDS PostgreSQL",
        )

        # =================================================================
        # Backend Stack (App Runner)
        # =================================================================
        # Get Amplify URL from context or use placeholder
        amplify_app_url = app.node.try_get_context("amplify_app_url") or ""
        
        backend_stack = BackendStack(
            app,
            "VowBackendStack",
            env=env,
            description="Vow App Backend - FastAPI on App Runner",
            vpc=database_stack.vpc,
            database_secret=database_stack.database_secret,
            database_endpoint=database_stack.database.db_instance_endpoint_address,
            database_port=database_stack.database.db_instance_endpoint_port,
            amplify_app_url=amplify_app_url,
        )

        # Set stack dependencies
        backend_stack.add_dependency(database_stack)

    # Synthesize CloudFormation template
    app.synth()


if __name__ == "__main__":
    main()
