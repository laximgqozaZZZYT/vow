#!/bin/bash
# =================================================================
# Health Check Script for VOW Environments
# =================================================================
# 使用方法:
#   ./health-check.sh development   # 開発環境のヘルスチェック
#   ./health-check.sh production    # 本番環境のヘルスチェック
#   ./health-check.sh all           # 両環境のヘルスチェック
# =================================================================

set -e

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定
AWS_REGION="ap-northeast-1"
DEV_LAMBDA_NAME="vow-development-api"
PROD_LAMBDA_NAME="vow-production-api"

# 引数チェック
ENV=${1:-"all"}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VOW Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Lambda関数のヘルスチェック
check_lambda() {
    local FUNCTION_NAME=$1
    local ALIAS=$2
    local ENV_NAME=$3
    
    echo -e "${YELLOW}Checking Lambda: ${FUNCTION_NAME}:${ALIAS}${NC}"
    
    # 関数の存在確認
    if ! aws lambda get-function --function-name "${FUNCTION_NAME}" --region "${AWS_REGION}" &>/dev/null; then
        echo -e "${RED}  ✗ Lambda function not found${NC}"
        return 1
    fi
    
    # エイリアスの存在確認
    if ! aws lambda get-alias --function-name "${FUNCTION_NAME}" --name "${ALIAS}" --region "${AWS_REGION}" &>/dev/null; then
        echo -e "${YELLOW}  ⚠ Alias '${ALIAS}' not found, using \$LATEST${NC}"
        ALIAS="\$LATEST"
    fi
    
    # ヘルスチェック呼び出し
    RESPONSE=$(aws lambda invoke \
        --function-name "${FUNCTION_NAME}:${ALIAS}" \
        --payload '{"httpMethod": "GET", "path": "/health", "headers": {}, "queryStringParameters": null, "body": null}' \
        --cli-binary-format raw-in-base64-out \
        --region "${AWS_REGION}" \
        /tmp/lambda-response.json 2>&1)
    
    if [ $? -eq 0 ]; then
        # レスポンスの解析
        if [ -f /tmp/lambda-response.json ]; then
            BODY=$(cat /tmp/lambda-response.json)
            STATUS_CODE=$(echo "$BODY" | jq -r '.statusCode // empty' 2>/dev/null)
            
            if [ "$STATUS_CODE" == "200" ]; then
                echo -e "${GREEN}  ✓ Health check passed (status: 200)${NC}"
                return 0
            else
                echo -e "${YELLOW}  ⚠ Health check returned status: ${STATUS_CODE:-unknown}${NC}"
                echo "    Response: $BODY"
                return 0
            fi
        fi
    fi
    
    echo -e "${RED}  ✗ Health check failed${NC}"
    return 1
}

# API Gatewayのヘルスチェック
check_api_gateway() {
    local URL=$1
    local ENV_NAME=$2
    
    echo -e "${YELLOW}Checking API Gateway: ${URL}${NC}"
    
    if [ -z "$URL" ]; then
        echo -e "${YELLOW}  ⚠ API Gateway URL not configured${NC}"
        return 0
    fi
    
    RESPONSE=$(curl -s -o /tmp/api-response.json -w "%{http_code}" "${URL}/health" 2>/dev/null)
    
    if [ "$RESPONSE" == "200" ]; then
        echo -e "${GREEN}  ✓ API Gateway health check passed${NC}"
        return 0
    else
        echo -e "${YELLOW}  ⚠ API Gateway returned status: ${RESPONSE}${NC}"
        return 0
    fi
}

# Amplifyのヘルスチェック
check_amplify() {
    local URL=$1
    local ENV_NAME=$2
    
    echo -e "${YELLOW}Checking Amplify: ${URL}${NC}"
    
    if [ -z "$URL" ]; then
        echo -e "${YELLOW}  ⚠ Amplify URL not configured${NC}"
        return 0
    fi
    
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}" 2>/dev/null)
    
    if [ "$RESPONSE" == "200" ]; then
        echo -e "${GREEN}  ✓ Amplify health check passed${NC}"
        return 0
    else
        echo -e "${YELLOW}  ⚠ Amplify returned status: ${RESPONSE}${NC}"
        return 0
    fi
}

# 開発環境チェック
check_development() {
    echo ""
    echo -e "${BLUE}--- Development Environment ---${NC}"
    echo ""
    
    check_lambda "$DEV_LAMBDA_NAME" "development" "Development"
    check_amplify "https://develop.do1k9oyyorn24.amplifyapp.com" "Development"
}

# 本番環境チェック
check_production() {
    echo ""
    echo -e "${BLUE}--- Production Environment ---${NC}"
    echo ""
    
    check_lambda "$PROD_LAMBDA_NAME" "production" "Production"
    check_api_gateway "https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production" "Production"
    check_amplify "https://main.do1k9oyyorn24.amplifyapp.com" "Production"
}

# メイン処理
case "$ENV" in
    "development"|"dev")
        check_development
        ;;
    "production"|"prod")
        check_production
        ;;
    "all")
        check_development
        check_production
        ;;
    *)
        echo -e "${RED}Error: Invalid environment '$ENV'${NC}"
        echo "Usage: $0 [development|production|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Health check completed${NC}"
echo -e "${GREEN}========================================${NC}"
