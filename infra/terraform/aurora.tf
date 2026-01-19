# =================================================================
# Aurora Serverless v2 PostgreSQL
# Cost-optimized database (~$44/month at 0.5 ACU minimum)
# =================================================================

# =================================================================
# DB Subnet Group
# =================================================================

resource "aws_db_subnet_group" "aurora" {
  name        = "${var.project_name}-${var.environment}-aurora-subnet-group"
  description = "Subnet group for Aurora Serverless v2"
  subnet_ids  = aws_subnet.isolated[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora-subnet-group"
  }
}

# =================================================================
# Aurora Cluster (Serverless v2)
# =================================================================

resource "aws_rds_cluster" "aurora" {
  cluster_identifier = "${var.project_name}-${var.environment}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "15.8"  # Aurora PostgreSQL 15.8 (Serverless v2対応)
  database_name      = var.database_name

  # Secrets Manager でパスワード管理
  manage_master_user_password = true
  master_username             = "vowadmin"

  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  # Serverless v2 設定
  serverlessv2_scaling_configuration {
    min_capacity = var.aurora_min_capacity
    max_capacity = var.aurora_max_capacity
  }

  storage_encrypted       = true
  backup_retention_period = var.environment == "production" ? 14 : 7
  
  # 本番環境ではスナップショットを保持
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-${var.environment}-final-snapshot" : null
  
  # 本番環境では削除保護を有効化
  deletion_protection = var.environment == "production" ? true : false

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora"
  }
}

# =================================================================
# Aurora Instance (Serverless v2)
# =================================================================

resource "aws_rds_cluster_instance" "aurora" {
  identifier         = "${var.project_name}-${var.environment}-aurora-instance"
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version

  publicly_accessible = false

  tags = {
    Name = "${var.project_name}-${var.environment}-aurora-instance"
  }
}
