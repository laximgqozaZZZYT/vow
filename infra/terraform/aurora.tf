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
  backup_retention_period = 7
  skip_final_snapshot     = var.environment == "development" ? true : false
  # 本番環境では false に変更
  deletion_protection = false

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
