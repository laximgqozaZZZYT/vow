# =================================================================
# AWS DMS for Supabase to Aurora Migration
# Enables zero-downtime database migration with Full Load + CDC
# =================================================================

# =================================================================
# DMS Service-Linked Role (Required for VPC access)
# =================================================================

resource "aws_iam_role" "dms_vpc_role" {
  count = var.enable_dms ? 1 : 0

  name = "dms-vpc-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "dms.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "dms-vpc-role"
  }
}

resource "aws_iam_role_policy_attachment" "dms_vpc_role" {
  count = var.enable_dms ? 1 : 0

  role       = aws_iam_role.dms_vpc_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonDMSVPCManagementRole"
}

# =================================================================
# DMS Replication Subnet Group
# =================================================================

resource "aws_dms_replication_subnet_group" "main" {
  count = var.enable_dms ? 1 : 0

  replication_subnet_group_id          = "${var.project_name}-${var.environment}-dms-subnet"
  replication_subnet_group_description = "DMS subnet group for database migration"
  subnet_ids                           = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-subnet-group"
  }

  depends_on = [aws_iam_role_policy_attachment.dms_vpc_role]
}

# =================================================================
# DMS Security Group
# =================================================================

resource "aws_security_group" "dms" {
  count = var.enable_dms ? 1 : 0

  name        = "${var.project_name}-${var.environment}-dms-sg"
  description = "Security group for DMS replication instance"
  vpc_id      = aws_vpc.main.id

  # Outbound to Supabase (external PostgreSQL)
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow PostgreSQL to Supabase"
  }

  # Outbound to Aurora (internal)
  egress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.aurora.id]
    description     = "Allow PostgreSQL to Aurora"
  }

  # HTTPS for AWS APIs
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow HTTPS for AWS APIs"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-sg"
  }
}

# Allow DMS to connect to Aurora
resource "aws_security_group_rule" "aurora_from_dms" {
  count = var.enable_dms ? 1 : 0

  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.dms[0].id
  security_group_id        = aws_security_group.aurora.id
  description              = "Allow PostgreSQL from DMS"
}

# =================================================================
# DMS Replication Instance
# =================================================================

resource "aws_dms_replication_instance" "main" {
  count = var.enable_dms ? 1 : 0

  replication_instance_id     = "${var.project_name}-${var.environment}-dms"
  replication_instance_class  = "dms.t3.medium"
  allocated_storage           = 50
  vpc_security_group_ids      = [aws_security_group.dms[0].id]
  replication_subnet_group_id = aws_dms_replication_subnet_group.main[0].id

  publicly_accessible = false
  multi_az            = false # Single AZ for cost optimization

  engine_version = "3.5.3"

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-instance"
  }

  depends_on = [aws_dms_replication_subnet_group.main]
}

# =================================================================
# IAM Role for DMS Secrets Manager Access
# =================================================================

resource "aws_iam_role" "dms_secrets_access" {
  count = var.enable_dms ? 1 : 0

  name = "${var.project_name}-${var.environment}-dms-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "dms.amazonaws.com",
            "dms.${var.aws_region}.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-secrets-role"
  }
}

resource "aws_iam_role_policy" "dms_secrets_access" {
  count = var.enable_dms ? 1 : 0

  name = "${var.project_name}-${var.environment}-dms-secrets-policy"
  role = aws_iam_role.dms_secrets_access[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_rds_cluster.aurora.master_user_secret[0].secret_arn
      }
    ]
  })
}


# =================================================================
# DMS Source Endpoint (Supabase PostgreSQL)
# Using Supavisor pooler for IPv4 connectivity (direct DB is IPv6 only)
# =================================================================

resource "aws_dms_endpoint" "source" {
  count = var.enable_dms && var.supabase_pooler_host != "" ? 1 : 0

  endpoint_id   = "${var.project_name}-${var.environment}-supabase-source"
  endpoint_type = "source"
  engine_name   = "postgres"

  # Use Supabase pooler (IPv4) instead of direct DB (IPv6 only)
  server_name   = var.supabase_pooler_host
  port          = 5432
  database_name = var.supabase_database
  username      = var.supabase_username
  password      = var.supabase_password
  ssl_mode      = "require"

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-source"
  }
}

# =================================================================
# DMS Target Endpoint (Aurora Serverless v2)
# Using direct authentication (Secrets Manager format incompatible)
# =================================================================

resource "aws_dms_endpoint" "target" {
  count = var.enable_dms ? 1 : 0

  endpoint_id   = "${var.project_name}-${var.environment}-aurora-target"
  endpoint_type = "target"
  engine_name   = "aurora-postgresql"

  server_name   = aws_rds_cluster.aurora.endpoint
  port          = aws_rds_cluster.aurora.port
  database_name = var.database_name
  username      = var.aurora_master_username
  password      = var.aurora_master_password

  ssl_mode = "require"

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-target"
  }
}

# =================================================================
# DMS Replication Task (Full Load + CDC)
# =================================================================

resource "aws_dms_replication_task" "main" {
  count = var.enable_dms && var.supabase_host != "" ? 1 : 0

  replication_task_id      = "${var.project_name}-${var.environment}-migration"
  migration_type           = "full-load-and-cdc"
  replication_instance_arn = aws_dms_replication_instance.main[0].replication_instance_arn
  source_endpoint_arn      = aws_dms_endpoint.source[0].endpoint_arn
  target_endpoint_arn      = aws_dms_endpoint.target[0].endpoint_arn

  # Table mappings - migrate all tables from public schema
  table_mappings = jsonencode({
    rules = [
      {
        rule-type = "selection"
        rule-id   = "1"
        rule-name = "include-all-public-tables"
        object-locator = {
          schema-name = "public"
          table-name  = "%"
        }
        rule-action = "include"
      },
      {
        rule-type = "selection"
        rule-id   = "2"
        rule-name = "exclude-auth-schema"
        object-locator = {
          schema-name = "auth"
          table-name  = "%"
        }
        rule-action = "exclude"
      },
      {
        rule-type = "selection"
        rule-id   = "3"
        rule-name = "exclude-storage-schema"
        object-locator = {
          schema-name = "storage"
          table-name  = "%"
        }
        rule-action = "exclude"
      }
    ]
  })

  # Replication task settings
  replication_task_settings = jsonencode({
    TargetMetadata = {
      SupportLobs        = true
      FullLobMode        = false
      LobChunkSize       = 64
      LimitedSizeLobMode = true
      LobMaxSize         = 32
    }
    FullLoadSettings = {
      TargetTablePrepMode   = "DROP_AND_CREATE"
      CreatePkAfterFullLoad = false
      StopTaskCachedChangesApplied = false
      StopTaskCachedChangesNotApplied = false
      MaxFullLoadSubTasks   = 8
      TransactionConsistencyTimeout = 600
      CommitRate            = 10000
    }
    ChangeProcessingTuning = {
      BatchApplyEnabled = true
      BatchApplyPreserveTransaction = true
      BatchSplitSize    = 0
      MinTransactionSize = 1000
      CommitTimeout     = 1
      MemoryLimitTotal  = 1024
      MemoryKeepTime    = 60
      StatementCacheSize = 50
    }
    Logging = {
      EnableLogging = true
      LogComponents = [
        {
          Id       = "SOURCE_UNLOAD"
          Severity = "LOGGER_SEVERITY_DEFAULT"
        },
        {
          Id       = "SOURCE_CAPTURE"
          Severity = "LOGGER_SEVERITY_DEFAULT"
        },
        {
          Id       = "TARGET_LOAD"
          Severity = "LOGGER_SEVERITY_DEFAULT"
        },
        {
          Id       = "TARGET_APPLY"
          Severity = "LOGGER_SEVERITY_DEFAULT"
        }
      ]
    }
    ControlTablesSettings = {
      ControlSchema                 = ""
      HistoryTimeslotInMinutes      = 5
      HistoryTableEnabled           = false
      SuspendedTablesTableEnabled   = false
      StatusTableEnabled            = false
    }
    ErrorBehavior = {
      DataErrorPolicy                = "LOG_ERROR"
      DataTruncationErrorPolicy      = "LOG_ERROR"
      DataErrorEscalationPolicy      = "SUSPEND_TABLE"
      DataErrorEscalationCount       = 0
      TableErrorPolicy               = "SUSPEND_TABLE"
      TableErrorEscalationPolicy     = "STOP_TASK"
      TableErrorEscalationCount      = 0
      RecoverableErrorCount          = -1
      RecoverableErrorInterval       = 5
      RecoverableErrorThrottling     = true
      RecoverableErrorThrottlingMax  = 1800
      ApplyErrorDeletePolicy         = "IGNORE_RECORD"
      ApplyErrorInsertPolicy         = "LOG_ERROR"
      ApplyErrorUpdatePolicy         = "LOG_ERROR"
      ApplyErrorEscalationPolicy     = "LOG_ERROR"
      ApplyErrorEscalationCount      = 0
      FullLoadIgnoreConflicts        = true
    }
  })

  tags = {
    Name = "${var.project_name}-${var.environment}-dms-task"
  }

  depends_on = [
    aws_dms_replication_instance.main,
    aws_dms_endpoint.source,
    aws_dms_endpoint.target
  ]
}
