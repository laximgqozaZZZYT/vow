"""
BackendLambdaStack - TypeScript Backend on AWS Lambda

This stack creates:
- Lambda Function for TypeScript backend (Hono framework)
- API Gateway HTTP API for Lambda integration
- EventBridge rules for scheduled tasks
- IAM roles and policies

The backend uses:
- Hono framework for HTTP handling
- Zod for schema validation
- jose for JWT handling
"""

import os
from pathlib import Path

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_lambda as lambda_,
    aws_apigatewayv2 as apigwv2,
    aws_apigatewayv2_integrations as apigwv2_integrations,
    aws_events as events,
    aws_events_targets as targets,
    aws_iam as iam,
    aws_logs as logs,
)
from constructs import Construct


class BackendLambdaStack(Stack):
    """
    CDK Stack for Backend on Lambda.
    
    Deploys the TypeScript Hono backend with API Gateway HTTP API
    and EventBridge scheduled events.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        supabase_url: str = "",
        supabase_service_role_key: str = "",
        jwt_secret: str = "",
        slack_client_id: str = "",
        slack_client_secret: str = "",
        slack_signing_secret: str = "",
        token_encryption_key: str = "",
        cors_origins: list[str] = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        if cors_origins is None:
            cors_origins = ["http://localhost:3000"]

        # =================================================================
        # Lambda Execution Role
        # =================================================================
        lambda_role = iam.Role(
            self,
            "BackendLambdaRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            description="Execution role for backend Lambda",
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name(
                    "service-role/AWSLambdaBasicExecutionRole"
                ),
            ],
        )

        # =================================================================
        # CloudWatch Log Group
        # =================================================================
        log_group = logs.LogGroup(
            self,
            "BackendLogGroup",
            log_group_name="/aws/lambda/vow-backend",
            retention=logs.RetentionDays.TWO_WEEKS,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # =================================================================
        # Lambda Function
        # =================================================================
        self.lambda_function = lambda_.Function(
            self,
            "BackendFunction",
            function_name="vow-backend",
            description="TypeScript backend for Vow habit tracking (Hono framework)",
            runtime=lambda_.Runtime.NODEJS_20_X,
            handler="lambda-package/lambda.handler",
            # Path to lambda-package directory (relative to workspace root)
            # CDK resolves paths from the current working directory
            code=lambda_.Code.from_asset(
                path=str(Path(__file__).parent.parent.parent / "backend" / "lambda-package"),
            ),
            timeout=Duration.seconds(30),
            memory_size=512,
            role=lambda_role,
            environment={
                "NODE_ENV": "production",
                "SUPABASE_URL": supabase_url or "SET_VIA_CONSOLE",
                "SUPABASE_SERVICE_ROLE_KEY": supabase_service_role_key or "SET_VIA_CONSOLE",
                "JWT_SECRET": jwt_secret or "SET_VIA_CONSOLE",
                "SLACK_CLIENT_ID": slack_client_id or "SET_VIA_CONSOLE",
                "SLACK_CLIENT_SECRET": slack_client_secret or "SET_VIA_CONSOLE",
                "SLACK_SIGNING_SECRET": slack_signing_secret or "SET_VIA_CONSOLE",
                "TOKEN_ENCRYPTION_KEY": token_encryption_key or "SET_VIA_CONSOLE",
                "CORS_ORIGINS": ",".join(cors_origins),
            },
            log_group=log_group,
        )

        # =================================================================
        # API Gateway HTTP API
        # =================================================================
        http_api = apigwv2.HttpApi(
            self,
            "BackendHttpApi",
            api_name="vow-backend-api",
            description="HTTP API for backend",
            cors_preflight=apigwv2.CorsPreflightOptions(
                allow_origins=cors_origins,
                allow_methods=[
                    apigwv2.CorsHttpMethod.GET,
                    apigwv2.CorsHttpMethod.POST,
                    apigwv2.CorsHttpMethod.PUT,
                    apigwv2.CorsHttpMethod.DELETE,
                    apigwv2.CorsHttpMethod.OPTIONS,
                ],
                allow_headers=["*"],
                max_age=Duration.hours(1),
            ),
        )

        # Lambda integration
        lambda_integration = apigwv2_integrations.HttpLambdaIntegration(
            "LambdaIntegration",
            self.lambda_function,
        )

        # Add catch-all route
        http_api.add_routes(
            path="/{proxy+}",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )

        # Add root route
        http_api.add_routes(
            path="/",
            methods=[apigwv2.HttpMethod.ANY],
            integration=lambda_integration,
        )

        # =================================================================
        # EventBridge Rules for Scheduled Tasks
        # =================================================================
        
        # Reminder check - every 5 minutes
        reminder_rule = events.Rule(
            self,
            "ReminderCheckRule",
            rule_name="vow-reminder-check",
            description="Trigger reminder check every 5 minutes",
            schedule=events.Schedule.rate(Duration.minutes(5)),
        )
        reminder_rule.add_target(
            targets.LambdaFunction(
                self.lambda_function,
                event=events.RuleTargetInput.from_object({
                    "source": "aws.scheduler",
                    "detail-type": "reminder-check",
                }),
            )
        )

        # Follow-up check - every 15 minutes
        followup_rule = events.Rule(
            self,
            "FollowUpCheckRule",
            rule_name="vow-follow-up-check",
            description="Trigger follow-up check every 15 minutes",
            schedule=events.Schedule.rate(Duration.minutes(15)),
        )
        followup_rule.add_target(
            targets.LambdaFunction(
                self.lambda_function,
                event=events.RuleTargetInput.from_object({
                    "source": "aws.scheduler",
                    "detail-type": "follow-up-check",
                }),
            )
        )

        # Weekly report - every 15 minutes (checks if it's time to send)
        weekly_report_rule = events.Rule(
            self,
            "WeeklyReportRule",
            rule_name="vow-weekly-report",
            description="Trigger weekly report check every 15 minutes",
            schedule=events.Schedule.rate(Duration.minutes(15)),
        )
        weekly_report_rule.add_target(
            targets.LambdaFunction(
                self.lambda_function,
                event=events.RuleTargetInput.from_object({
                    "source": "aws.scheduler",
                    "detail-type": "weekly-report",
                }),
            )
        )

        # =================================================================
        # Outputs
        # =================================================================
        CfnOutput(
            self,
            "LambdaFunctionArn",
            value=self.lambda_function.function_arn,
            description="Lambda Function ARN",
            export_name="VowBackendLambdaArn",
        )

        CfnOutput(
            self,
            "ApiEndpoint",
            value=http_api.api_endpoint,
            description="API Gateway HTTP API Endpoint",
            export_name="VowBackendApiEndpoint",
        )

        CfnOutput(
            self,
            "LogGroupName",
            value=log_group.log_group_name,
            description="CloudWatch Log Group Name",
        )
