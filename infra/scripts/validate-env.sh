#!/bin/bash
# =================================================================
# Environment Configuration Validation Script
# =================================================================
# 使用方法:
#   ./validate-env.sh development   # 開発環境の設定検証
#   ./validate-env.sh production    # 本番環境の設定検証
# =================================================================

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")/terraform"

# 引数チェック
if [ -z "$1" ]; then
    echo -e "${RED}Error: Environment name is required${NC}"
    echo "Usage: $0 <environment>"
    echo "  environment: development or production"
    exit 1
fi

ENV=$1
TFVARS_FILE="$TERRAFORM_DIR/terraform.${ENV}.tfvars"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Environment Configuration Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENV${NC}"
echo ""

# tfvarsファイルの存在確認
if [ ! -f "$TFVARS_FILE" ]; then
    echo -e "${RED}Error: tfvars file not found: $TFVARS_FILE${NC}"
    exit 1
fi

ERRORS=0
WARNINGS=0

# 環境名の一貫性チェック
echo -e "${YELLOW}1. Checking environment name consistency...${NC}"
TFVARS_ENV=$(grep '^environment' "$TFVARS_FILE" | cut -d'"' -f2)
if [ "$TFVARS_ENV" != "$ENV" ]; then
    echo -e "${RED}  ✗ Environment mismatch: tfvars has '$TFVARS_ENV', expected '$ENV'${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}  ✓ Environment name is consistent${NC}"
fi

# 必須変数のチェック
echo ""
echo -e "${YELLOW}2. Checking required variables...${NC}"

check_variable() {
    local VAR_NAME=$1
    local REQUIRED=$2
    local VALUE=$(grep "^${VAR_NAME}" "$TFVARS_FILE" | cut -d'"' -f2 | head -1)
    
    if [ -z "$VALUE" ] || [ "$VALUE" == "" ]; then
        if [ "$REQUIRED" == "required" ]; then
            echo -e "${RED}  ✗ $VAR_NAME is not set (required)${NC}"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}  ⚠ $VAR_NAME is not set (optional, use TF_VAR)${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${GREEN}  ✓ $VAR_NAME is set${NC}"
    fi
}

# 必須変数
check_variable "environment" "required"
check_variable "project_name" "required"
check_variable "aws_region" "required"

# Lambda設定
echo ""
echo -e "${YELLOW}3. Checking Lambda configuration...${NC}"
check_variable "lambda_s3_bucket" "required"
check_variable "lambda_s3_key" "required"
check_variable "lambda_memory_size" "required"
check_variable "lambda_timeout" "required"

# 環境変数（TF_VAR経由で設定されることが多い）
echo ""
echo -e "${YELLOW}4. Checking environment-specific variables...${NC}"
check_variable "supabase_url" "optional"
check_variable "supabase_anon_key" "optional"
check_variable "slack_client_id" "optional"
check_variable "slack_client_secret" "optional"

# CORS設定のチェック
echo ""
echo -e "${YELLOW}5. Checking CORS configuration...${NC}"
CORS_ORIGINS=$(grep -A 10 'cors_origins' "$TFVARS_FILE" | grep -E '^\s*"' | tr -d ' ",' | head -5)
if [ -z "$CORS_ORIGINS" ]; then
    echo -e "${YELLOW}  ⚠ cors_origins is not configured${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}  ✓ cors_origins is configured:${NC}"
    echo "$CORS_ORIGINS" | while read -r origin; do
        echo "    - $origin"
    done
fi

# Amplify設定のチェック
echo ""
echo -e "${YELLOW}6. Checking Amplify configuration...${NC}"
check_variable "amplify_env_monorepo_app_root" "required"
check_variable "github_repository_url" "optional"

# GitHub Actionsワークフローの存在確認
echo ""
echo -e "${YELLOW}7. Checking GitHub Actions workflows...${NC}"
WORKFLOW_DIR="$(dirname "$TERRAFORM_DIR")/../.github/workflows"

if [ "$ENV" == "development" ]; then
    if [ -f "$WORKFLOW_DIR/deploy-lambda-dev.yml" ]; then
        echo -e "${GREEN}  ✓ deploy-lambda-dev.yml exists${NC}"
    else
        echo -e "${RED}  ✗ deploy-lambda-dev.yml not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
elif [ "$ENV" == "production" ]; then
    if [ -f "$WORKFLOW_DIR/deploy-lambda-prod.yml" ]; then
        echo -e "${GREEN}  ✓ deploy-lambda-prod.yml exists${NC}"
    else
        echo -e "${RED}  ✗ deploy-lambda-prod.yml not found${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

# 結果サマリー
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}Errors: $ERRORS${NC}"
fi
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
fi

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Validation completed with warnings${NC}"
    echo ""
    echo "Note: Optional variables can be set via TF_VAR_<variable_name> environment variables"
    exit 0
else
    echo -e "${RED}✗ Validation failed with errors${NC}"
    exit 1
fi
