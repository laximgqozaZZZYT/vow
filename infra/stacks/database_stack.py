"""
DatabaseStack - RDS PostgreSQL for Vow Backend

This stack creates:
- VPC with public, private, and isolated subnets
- RDS PostgreSQL instance (db.t3.micro for development)
- Security groups for database access
- Secrets Manager for database credentials
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_secretsmanager as secretsmanager,
)
from constructs import Construct


class DatabaseStack(Stack):
    """
    CDK Stack for RDS PostgreSQL Database.
    
    Creates a VPC with proper subnet configuration and an RDS
    PostgreSQL instance for the Vow backend API.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # =================================================================
        # VPC Configuration
        # =================================================================
        self.vpc = ec2.Vpc(
            self,
            "BackendVpc",
            vpc_name="vow-backend-vpc",
            max_azs=2,
            nat_gateways=1,  # Single NAT for cost optimization in dev
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                ec2.SubnetConfiguration(
                    name="Isolated",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
        )

        # =================================================================
        # Security Group for RDS
        # =================================================================
        self.db_security_group = ec2.SecurityGroup(
            self,
            "DatabaseSecurityGroup",
            vpc=self.vpc,
            security_group_name="vow-db-sg",
            description="Security group for RDS PostgreSQL",
            allow_all_outbound=False,
        )

        # Allow PostgreSQL access from within VPC (for App Runner VPC Connector)
        self.db_security_group.add_ingress_rule(
            peer=ec2.Peer.ipv4(self.vpc.vpc_cidr_block),
            connection=ec2.Port.tcp(5432),
            description="Allow PostgreSQL from VPC",
        )

        # =================================================================
        # Database Credentials (Secrets Manager)
        # =================================================================
        self.database_secret = secretsmanager.Secret(
            self,
            "DatabaseSecret",
            secret_name="/vow/database-credentials",
            description="RDS PostgreSQL credentials for Vow backend",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                secret_string_template='{"username": "vowadmin"}',
                generate_string_key="password",
                exclude_punctuation=True,
                password_length=32,
            ),
        )

        # =================================================================
        # RDS PostgreSQL Instance
        # =================================================================
        self.database = rds.DatabaseInstance(
            self,
            "Database",
            instance_identifier="vow-backend-db",
            engine=rds.DatabaseInstanceEngine.postgres(
                version=rds.PostgresEngineVersion.VER_15,
            ),
            instance_type=ec2.InstanceType.of(
                ec2.InstanceClass.T3,
                ec2.InstanceSize.MICRO,
            ),
            vpc=self.vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
            ),
            security_groups=[self.db_security_group],
            credentials=rds.Credentials.from_secret(self.database_secret),
            database_name="vow",
            allocated_storage=20,
            max_allocated_storage=100,
            storage_encrypted=True,
            backup_retention=Duration.days(7),
            deletion_protection=False,  # Set to True for production
            removal_policy=RemovalPolicy.SNAPSHOT,
            publicly_accessible=False,
            multi_az=False,  # Single AZ for development cost savings
        )

        # =================================================================
        # Outputs
        # =================================================================
        CfnOutput(
            self,
            "VpcId",
            value=self.vpc.vpc_id,
            description="VPC ID",
            export_name="VowBackendVpcId",
        )

        CfnOutput(
            self,
            "DatabaseEndpoint",
            value=self.database.db_instance_endpoint_address,
            description="RDS Endpoint",
            export_name="VowDatabaseEndpoint",
        )

        CfnOutput(
            self,
            "DatabasePort",
            value=self.database.db_instance_endpoint_port,
            description="RDS Port",
            export_name="VowDatabasePort",
        )

        CfnOutput(
            self,
            "DatabaseSecretArn",
            value=self.database_secret.secret_arn,
            description="Database Secret ARN",
            export_name="VowDatabaseSecretArn",
        )
