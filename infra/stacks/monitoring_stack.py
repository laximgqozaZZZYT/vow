"""
CloudWatch Monitoring Stack for VOW Application

Lambda、API Gateway、Aurora Serverless v2の監視とアラームを設定。
"""

from aws_cdk import (
    Stack,
    Duration,
    CfnOutput,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cw_actions,
    aws_sns as sns,
    aws_sns_subscriptions as subscriptions,
    aws_lambda as lambda_,
)
from constructs import Construct
from typing import Optional, List


class MonitoringStack(Stack):
    """CloudWatch Monitoring Stack"""
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        lambda_function_name: str,
        api_gateway_name: str,
        aurora_cluster_id: str,
        alert_email: Optional[str] = None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        
        # SNS Topic for Alerts
        self.alert_topic = sns.Topic(
            self, "AlertTopic",
            topic_name="vow-alerts",
            display_name="VOW Application Alerts"
        )
        
        # Email Subscription
        if alert_email:
            self.alert_topic.add_subscription(
                subscriptions.EmailSubscription(alert_email)
            )
        
        # Lambda Alarms
        self._create_lambda_alarms(lambda_function_name)
        
        # API Gateway Alarms
        self._create_api_gateway_alarms(api_gateway_name)
        
        # Aurora Alarms
        self._create_aurora_alarms(aurora_cluster_id)
        
        # Dashboard
        self._create_dashboard(
            lambda_function_name,
            api_gateway_name,
            aurora_cluster_id
        )
        
        # Outputs
        CfnOutput(
            self, "AlertTopicArn",
            value=self.alert_topic.topic_arn,
            description="SNS Alert Topic ARN"
        )
        
        CfnOutput(
            self, "DashboardUrl",
            value=f"https://{self.region}.console.aws.amazon.com/cloudwatch/home?region={self.region}#dashboards:name=VOW-Dashboard",
            description="CloudWatch Dashboard URL"
        )
    
    def _create_lambda_alarms(self, function_name: str) -> None:
        """Lambda関数のアラームを作成"""
        
        # Error Rate Alarm
        error_metric = cloudwatch.Metric(
            namespace="AWS/Lambda",
            metric_name="Errors",
            dimensions_map={"FunctionName": function_name},
            statistic="Sum",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "LambdaErrorAlarm",
            alarm_name="vow-lambda-errors",
            alarm_description="Lambda function error rate is high",
            metric=error_metric,
            threshold=5,
            evaluation_periods=2,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # Duration Alarm (Cold Start Detection)
        duration_metric = cloudwatch.Metric(
            namespace="AWS/Lambda",
            metric_name="Duration",
            dimensions_map={"FunctionName": function_name},
            statistic="p99",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "LambdaDurationAlarm",
            alarm_name="vow-lambda-duration",
            alarm_description="Lambda p99 duration is high (possible cold starts)",
            metric=duration_metric,
            threshold=10000,  # 10 seconds
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # Throttles Alarm
        throttle_metric = cloudwatch.Metric(
            namespace="AWS/Lambda",
            metric_name="Throttles",
            dimensions_map={"FunctionName": function_name},
            statistic="Sum",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "LambdaThrottleAlarm",
            alarm_name="vow-lambda-throttles",
            alarm_description="Lambda function is being throttled",
            metric=throttle_metric,
            threshold=1,
            evaluation_periods=1,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
    
    def _create_api_gateway_alarms(self, api_name: str) -> None:
        """API Gatewayのアラームを作成"""
        
        # 5XX Error Alarm
        error_5xx_metric = cloudwatch.Metric(
            namespace="AWS/ApiGateway",
            metric_name="5XXError",
            dimensions_map={"ApiName": api_name},
            statistic="Sum",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "ApiGateway5xxAlarm",
            alarm_name="vow-api-5xx-errors",
            alarm_description="API Gateway 5XX error rate is high",
            metric=error_5xx_metric,
            threshold=10,
            evaluation_periods=2,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # 4XX Error Alarm (High Rate)
        error_4xx_metric = cloudwatch.Metric(
            namespace="AWS/ApiGateway",
            metric_name="4XXError",
            dimensions_map={"ApiName": api_name},
            statistic="Sum",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "ApiGateway4xxAlarm",
            alarm_name="vow-api-4xx-errors",
            alarm_description="API Gateway 4XX error rate is unusually high",
            metric=error_4xx_metric,
            threshold=100,
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # Latency Alarm
        latency_metric = cloudwatch.Metric(
            namespace="AWS/ApiGateway",
            metric_name="Latency",
            dimensions_map={"ApiName": api_name},
            statistic="p99",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "ApiGatewayLatencyAlarm",
            alarm_name="vow-api-latency",
            alarm_description="API Gateway p99 latency is high",
            metric=latency_metric,
            threshold=5000,  # 5 seconds
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
    
    def _create_aurora_alarms(self, cluster_id: str) -> None:
        """Aurora Serverless v2のアラームを作成"""
        
        # CPU Utilization Alarm
        cpu_metric = cloudwatch.Metric(
            namespace="AWS/RDS",
            metric_name="CPUUtilization",
            dimensions_map={"DBClusterIdentifier": cluster_id},
            statistic="Average",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "AuroraCpuAlarm",
            alarm_name="vow-aurora-cpu",
            alarm_description="Aurora CPU utilization is high",
            metric=cpu_metric,
            threshold=80,
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # ACU Utilization Alarm
        acu_metric = cloudwatch.Metric(
            namespace="AWS/RDS",
            metric_name="ServerlessDatabaseCapacity",
            dimensions_map={"DBClusterIdentifier": cluster_id},
            statistic="Average",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "AuroraAcuAlarm",
            alarm_name="vow-aurora-acu",
            alarm_description="Aurora ACU capacity is high",
            metric=acu_metric,
            threshold=4,  # 4 ACU (approaching max for cost control)
            evaluation_periods=3,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
        
        # Database Connections Alarm
        connections_metric = cloudwatch.Metric(
            namespace="AWS/RDS",
            metric_name="DatabaseConnections",
            dimensions_map={"DBClusterIdentifier": cluster_id},
            statistic="Average",
            period=Duration.minutes(5)
        )
        
        cloudwatch.Alarm(
            self, "AuroraConnectionsAlarm",
            alarm_name="vow-aurora-connections",
            alarm_description="Aurora database connections are high",
            metric=connections_metric,
            threshold=50,
            evaluation_periods=2,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        ).add_alarm_action(cw_actions.SnsAction(self.alert_topic))
    
    def _create_dashboard(
        self,
        lambda_function_name: str,
        api_name: str,
        cluster_id: str
    ) -> None:
        """CloudWatch Dashboardを作成"""
        
        dashboard = cloudwatch.Dashboard(
            self, "VowDashboard",
            dashboard_name="VOW-Dashboard"
        )
        
        # Lambda Metrics Row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Lambda Metrics",
                width=24,
                height=1
            )
        )
        
        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Lambda Invocations",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Invocations",
                        dimensions_map={"FunctionName": lambda_function_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="Lambda Duration",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Duration",
                        dimensions_map={"FunctionName": lambda_function_name},
                        statistic="Average",
                        period=Duration.minutes(1)
                    ),
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Duration",
                        dimensions_map={"FunctionName": lambda_function_name},
                        statistic="p99",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="Lambda Errors & Throttles",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Errors",
                        dimensions_map={"FunctionName": lambda_function_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    ),
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Throttles",
                        dimensions_map={"FunctionName": lambda_function_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            )
        )
        
        # API Gateway Metrics Row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# API Gateway Metrics",
                width=24,
                height=1
            )
        )
        
        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="API Requests",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="Count",
                        dimensions_map={"ApiName": api_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="API Latency",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="Latency",
                        dimensions_map={"ApiName": api_name},
                        statistic="Average",
                        period=Duration.minutes(1)
                    ),
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="Latency",
                        dimensions_map={"ApiName": api_name},
                        statistic="p99",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="API Errors",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="4XXError",
                        dimensions_map={"ApiName": api_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    ),
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="5XXError",
                        dimensions_map={"ApiName": api_name},
                        statistic="Sum",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            )
        )
        
        # Aurora Metrics Row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Aurora Serverless v2 Metrics",
                width=24,
                height=1
            )
        )
        
        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Aurora ACU Capacity",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="ServerlessDatabaseCapacity",
                        dimensions_map={"DBClusterIdentifier": cluster_id},
                        statistic="Average",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="Aurora CPU & Memory",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="CPUUtilization",
                        dimensions_map={"DBClusterIdentifier": cluster_id},
                        statistic="Average",
                        period=Duration.minutes(1)
                    )
                ],
                right=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="FreeableMemory",
                        dimensions_map={"DBClusterIdentifier": cluster_id},
                        statistic="Average",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            ),
            cloudwatch.GraphWidget(
                title="Aurora Connections",
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="DatabaseConnections",
                        dimensions_map={"DBClusterIdentifier": cluster_id},
                        statistic="Average",
                        period=Duration.minutes(1)
                    )
                ],
                width=8
            )
        )
