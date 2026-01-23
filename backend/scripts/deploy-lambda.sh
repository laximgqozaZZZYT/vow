#!/bin/bash
# Deploy Hono Lambda to AWS
# Usage: ./deploy-lambda.sh [bucket-name] [environment]

set -e

BUCKET_NAME=${1:-"vow-lambda-deployments"}
ENVIRONMENT=${2:-"development"}
REGION=${AWS_REGION:-"ap-northeast-1"}
TIMESTAMP=$(date +%Y%m%d%H%M%S)
S3_KEY="hono-api/${ENVIRONMENT}/lambda-${TIMESTAMP}.zip"

echo "=== Vow Hono Lambda Deployment ==="
echo "Bucket: $BUCKET_NAME"
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "S3 Key: $S3_KEY"
echo ""

# Step 1: Build the Lambda package
echo "Step 1: Building Lambda package..."
cd "$(dirname "$0")/.."
./scripts/build-lambda.sh

# Step 2: Create S3 bucket if it doesn't exist
echo ""
echo "Step 2: Checking S3 bucket..."
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 > /dev/null; then
    echo "Creating S3 bucket: ${BUCKET_NAME}"
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
fi

# Step 3: Upload to S3
echo ""
echo "Step 3: Uploading to S3..."
aws s3 cp lambda-package.zip "s3://${BUCKET_NAME}/${S3_KEY}"
echo "Uploaded to: s3://${BUCKET_NAME}/${S3_KEY}"

# Step 4: Output Terraform variables
echo ""
echo "=== Terraform Variables ==="
echo "Add these to your terraform.tfvars:"
echo ""
echo "lambda_nodejs_s3_bucket = \"${BUCKET_NAME}\""
echo "lambda_nodejs_s3_key    = \"${S3_KEY}\""
echo ""

# Step 5: Apply Terraform (optional)
echo "=== Next Steps ==="
echo "1. Update infra/terraform/terraform.tfvars with the above values"
echo "2. Add required environment variables:"
echo "   - supabase_service_role_key"
echo "   - jwt_secret"
echo "3. Run: cd infra/terraform && terraform apply"
echo ""
echo "After deployment, update frontend/.env.local with:"
echo "NEXT_PUBLIC_BACKEND_API_URL=<hono_api_gateway_url from terraform output>"
