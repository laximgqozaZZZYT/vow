#!/bin/bash
# =================================================================
# Terraform Environment Switcher
# =================================================================
# 使用方法:
#   ./scripts/switch-env.sh development   # 開発環境に切り替え
#   ./scripts/switch-env.sh production    # 本番環境に切り替え
#   ./scripts/switch-env.sh development plan  # 開発環境でplan実行
#   ./scripts/switch-env.sh production apply  # 本番環境でapply実行
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
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

# 引数チェック
if [ -z "$1" ]; then
    echo -e "${RED}Error: Environment name is required${NC}"
    echo ""
    echo "Usage: $0 <environment> [command]"
    echo ""
    echo "Environments:"
    echo "  development  - Development environment"
    echo "  production   - Production environment"
    echo ""
    echo "Commands (optional):"
    echo "  plan    - Run terraform plan"
    echo "  apply   - Run terraform apply"
    echo "  destroy - Run terraform destroy (with confirmation)"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 development plan"
    echo "  $0 production apply"
    exit 1
fi

ENV=$1
COMMAND=${2:-""}

# 環境名の検証
if [[ "$ENV" != "development" && "$ENV" != "production" ]]; then
    echo -e "${RED}Error: Invalid environment '$ENV'${NC}"
    echo "Valid environments: development, production"
    exit 1
fi

# tfvarsファイルの存在確認
TFVARS_FILE="$TERRAFORM_DIR/terraform.${ENV}.tfvars"
if [ ! -f "$TFVARS_FILE" ]; then
    echo -e "${RED}Error: tfvars file not found: $TFVARS_FILE${NC}"
    exit 1
fi

# Terraformディレクトリに移動
cd "$TERRAFORM_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Terraform Environment Switcher${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENV${NC}"
echo -e "tfvars file: ${GREEN}$TFVARS_FILE${NC}"
echo ""

# Workspace切り替え
echo -e "${YELLOW}Switching to workspace: $ENV${NC}"
if terraform workspace select "$ENV" 2>/dev/null; then
    echo -e "${GREEN}✓ Switched to existing workspace: $ENV${NC}"
else
    echo -e "${YELLOW}Creating new workspace: $ENV${NC}"
    terraform workspace new "$ENV"
    echo -e "${GREEN}✓ Created and switched to workspace: $ENV${NC}"
fi

echo ""
echo -e "${GREEN}Current workspace: $(terraform workspace show)${NC}"
echo ""

# コマンド実行
case "$COMMAND" in
    "plan")
        echo -e "${YELLOW}Running terraform plan...${NC}"
        echo ""
        terraform plan -var-file="terraform.${ENV}.tfvars"
        ;;
    "apply")
        echo -e "${YELLOW}Running terraform apply...${NC}"
        echo ""
        if [ "$ENV" == "production" ]; then
            echo -e "${RED}⚠️  WARNING: You are about to apply changes to PRODUCTION!${NC}"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" != "yes" ]; then
                echo "Aborted."
                exit 0
            fi
        fi
        terraform apply -var-file="terraform.${ENV}.tfvars"
        ;;
    "destroy")
        echo -e "${RED}⚠️  WARNING: You are about to DESTROY resources in $ENV!${NC}"
        read -p "Type the environment name to confirm: " confirm
        if [ "$confirm" != "$ENV" ]; then
            echo "Aborted."
            exit 0
        fi
        terraform destroy -var-file="terraform.${ENV}.tfvars"
        ;;
    "")
        echo -e "${GREEN}Environment switched successfully.${NC}"
        echo ""
        echo "Next steps:"
        echo "  terraform plan -var-file=\"terraform.${ENV}.tfvars\""
        echo "  terraform apply -var-file=\"terraform.${ENV}.tfvars\""
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$COMMAND'${NC}"
        echo "Valid commands: plan, apply, destroy"
        exit 1
        ;;
esac
