"""
BackendStack - FastAPI Backend on AWS App Runner

This stack creates:
- ECR Repository for Docker images
- App Runner Service with VPC Connector
- SSM Parameters for configuration
- IAM roles and policies
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_ecr as ecr,
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_ssm as ssm,
    aws_secretsmanager as secretsmanager,
)
import aws_cdk.aws_apprunner_alpha as apprunner
from constructs import Construct


class BackendStack(Stack):
    """
    CDK Stack for FastAPI Backend on App Runner.
    
    Deploys the containerized FastAPI backend with VPC connectivity
    to RDS PostgreSQL.
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        vpc: ec2.IVpc,
        database_secret: secretsmanager.ISecret,
        database_endpoint: str,
        database_port: str,
        amplify_app_url: str = "",
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # =================================================================
        # ECR Repository
        # =================================================================
        self.ecr_repository = ecr.Repository(
            self,
            "BackendRepository",
            repository_name="vow-backend",
            removal_policy=RemovalPolicy.RETAIN,
            lifecycle_rules=[
                ecr.LifecycleRule(
                    max_image_count=10,
                    description="Keep only 10 images",
                ),
            ],
            image_scan_on_push=True,
        )

        # =================================================================
        # SSM Parameters for Configuration
        # =================================================================
        jwt_secret_param = ssm.StringParameter(
            self,
            "JwtSecretParam",
            parameter_name="/vow/jwt-secret",
            string_value="CHANGE_ME_IN_CONSOLE",  # Update via AWS Console
            description="JWT secret for authentication",
            tier=ssm.ParameterTier.STANDARD,
        )

        # =================================================================
        # VPC Connector for App Runner
        # =================================================================
        vpc_connector = apprunner.VpcConnector(
            self,
            "VpcConnector",
            vpc=vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
            ),
            vpc_connector_name="vow-backend-connector",
        )

        # =================================================================
        # App Runner Access Role (for ECR)
        # =================================================================
        access_role = iam.Role(
            self,
            "AppRunnerAccessRole",
            assumed_by=iam.ServicePrincipal("build.apprunner.amazonaws.com"),
            description="Role for App Runner to access ECR",
        )

        self.ecr_repository.grant_pull(access_role)

        # =================================================================
        # App Runner Instance Role (for runtime)
        # =================================================================
        instance_role = iam.Role(
            self,
            "AppRunnerInstanceRole",
            assumed_by=iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
            description="Role for App Runner service runtime",
        )

        # Grant access to Secrets Manager
        database_secret.grant_read(instance_role)

        # Grant access to SSM Parameters
        jwt_secret_param.grant_read(instance_role)

        # =================================================================
        # CORS Origins Configuration
        # =================================================================
        cors_origins = ["http://localhost:3000"]
        if amplify_app_url:
            cors_origins.append(amplify_app_url)

        # =================================================================
        # App Runner Service
        # =================================================================
        self.app_runner_service = apprunner.Service(
            self,
            "BackendService",
            service_name="vow-backend",
            source=apprunner.Source.from_ecr(
                repository=self.ecr_repository,
                tag_or_digest="latest",
                image_configuration=apprunner.ImageConfiguration(
                    port=8000,
                    environment_variables={
                        "DEBUG": "false",
                        "CORS_ORIGINS": str(cors_origins),
                        "DATABASE_HOST": database_endpoint,
                        "DATABASE_PORT": database_port,
                        "DATABASE_NAME": "vow",
                    },
                    environment_secrets={
                        "DATABASE_SECRET": apprunner.Secret.from_secrets_manager(
                            database_secret,
                        ),
                        "JWT_SECRET": apprunner.Secret.from_ssm_parameter(
                            jwt_secret_param,
                        ),
                    },
                ),
            ),
            access_role=access_role,
            instance_role=instance_role,
            cpu=apprunner.Cpu.ONE_VCPU,
            memory=apprunner.Memory.TWO_GB,
            vpc_connector=vpc_connector,
            health_check=apprunner.HealthCheck.http(
                path="/health",
                interval=Duration.seconds(10),
                timeout=Duration.seconds(5),
                healthy_threshold=1,
                unhealthy_threshold=3,
            ),
            auto_deployments_enabled=True,
        )

        # =================================================================
        # Outputs
        # =================================================================
        CfnOutput(
            self,
            "EcrRepositoryUri",
            value=self.ecr_repository.repository_uri,
            description="ECR Repository URI",
            export_name="VowBackendEcrUri",
        )

        CfnOutput(
            self,
            "AppRunnerServiceUrl",
            value=f"https://{self.app_runner_service.service_url}",
            description="App Runner Service URL",
            export_name="VowBackendUrl",
        )

        CfnOutput(
            self,
            "AppRunnerServiceArn",
            value=self.app_runner_service.service_arn,
            description="App Runner Service ARN",
            export_name="VowBackendServiceArn",
        )
