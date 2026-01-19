#!/bin/bash
# =================================================================
# VOW Production Migration Rollback Script
# =================================================================
# This script performs rollback from AWS to Vercel/Supabase
#
# Usage:
#   ./rollback.sh [--dry-run]
#
# Prerequisites:
#   - AWS CLI configured
#   - Vercel CLI configured
#   - Access to Supabase dashboard
# =================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
PROJECT_NAME="${PROJECT_NAME:-vow}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SNS_TOPIC_ARN="${SNS_TOPIC_ARN:-}"

# Parse arguments
DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo -e "${YELLOW}Running in DRY RUN mode - no changes will be made${NC}"
fi

echo "============================================================"
echo "VOW Production Migration Rollback"
echo "============================================================"
echo "Started at: $(date -Iseconds)"
echo "AWS Region: $AWS_REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Function to send SNS notification
send_notification() {
    local message="$1"
    local subject="$2"
    
    if [[ -n "$SNS_TOPIC_ARN" ]] && [[ "$DRY_RUN" == "false" ]]; then
        aws sns publish \
            --topic-arn "$SNS_TOPIC_ARN" \
            --message "$message" \
            --subject "$subject" \
            --region "$AWS_REGION" || true
    fi
    
    echo -e "${YELLOW}[NOTIFICATION] $subject${NC}"
    echo "$message"
}

# Function to confirm action
confirm() {
    local message="$1"
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY RUN] Would: $message${NC}"
        return 0
    fi
    
    read -p "$message (y/N): " response
    case "$response" in
        [yY][eE][sS]|[yY]) 
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

echo "============================================================"
echo "Step 1: Pre-rollback Checks"
echo "============================================================"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS CLI available${NC}"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials valid${NC}"

# Check Vercel CLI (optional)
if command -v vercel &> /dev/null; then
    echo -e "${GREEN}✓ Vercel CLI available${NC}"
else
    echo -e "${YELLOW}⚠ Vercel CLI not installed - manual Vercel steps required${NC}"
fi

echo ""
echo "============================================================"
echo "Step 2: Stop DMS Replication (if running)"
echo "============================================================"

# Get DMS task ARN
DMS_TASK_ARN=$(aws dms describe-replication-tasks \
    --filters "Name=replication-task-id,Values=${PROJECT_NAME}-${ENVIRONMENT}-migration" \
    --query "ReplicationTasks[0].ReplicationTaskArn" \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "None")

if [[ "$DMS_TASK_ARN" != "None" ]] && [[ -n "$DMS_TASK_ARN" ]]; then
    TASK_STATUS=$(aws dms describe-replication-tasks \
        --filters "Name=replication-task-arn,Values=$DMS_TASK_ARN" \
        --query "ReplicationTasks[0].Status" \
        --output text \
        --region "$AWS_REGION")
    
    echo "DMS Task Status: $TASK_STATUS"
    
    if [[ "$TASK_STATUS" == "running" ]]; then
        if confirm "Stop DMS replication task?"; then
            if [[ "$DRY_RUN" == "false" ]]; then
                aws dms stop-replication-task \
                    --replication-task-arn "$DMS_TASK_ARN" \
                    --region "$AWS_REGION"
                echo -e "${GREEN}✓ DMS task stop initiated${NC}"
            fi
        fi
    else
        echo -e "${GREEN}✓ DMS task not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠ No DMS task found${NC}"
fi

echo ""
echo "============================================================"
echo "Step 3: Vercel Redirect Configuration"
echo "============================================================"

echo "To remove the redirect from Vercel to AWS:"
echo ""
echo "Option A: Via Vercel Dashboard"
echo "  1. Go to https://vercel.com/dashboard"
echo "  2. Select the 'vow-app' project"
echo "  3. Go to Settings → Redirects"
echo "  4. Remove the redirect rule to AWS"
echo "  5. Redeploy the project"
echo ""
echo "Option B: Via vercel.json"
echo "  1. Edit frontend/vercel.json"
echo "  2. Remove the redirect configuration"
echo "  3. Commit and push to trigger redeploy"
echo ""

if confirm "Have you completed the Vercel redirect removal?"; then
    echo -e "${GREEN}✓ Vercel redirect removed${NC}"
else
    echo -e "${YELLOW}⚠ Skipping Vercel redirect removal${NC}"
fi

echo ""
echo "============================================================"
echo "Step 4: OAuth Callback URL Verification"
echo "============================================================"

echo "Verify OAuth callback URLs are configured for Supabase:"
echo ""
echo "Google OAuth (GCP Console):"
echo "  1. Go to https://console.cloud.google.com/apis/credentials"
echo "  2. Select your OAuth 2.0 Client"
echo "  3. Ensure Supabase callback URL is present:"
echo "     https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback"
echo ""
echo "GitHub OAuth (GitHub Developer Settings):"
echo "  1. Go to https://github.com/settings/developers"
echo "  2. Select your OAuth App"
echo "  3. Ensure Supabase callback URL is present:"
echo "     https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback"
echo ""

if confirm "Have you verified OAuth callback URLs?"; then
    echo -e "${GREEN}✓ OAuth callback URLs verified${NC}"
else
    echo -e "${YELLOW}⚠ Skipping OAuth verification${NC}"
fi

echo ""
echo "============================================================"
echo "Step 5: Send Rollback Notification"
echo "============================================================"

send_notification \
    "VOW Production rollback initiated at $(date -Iseconds). Traffic is being redirected back to Vercel/Supabase." \
    "[VOW] Production Rollback Initiated"

echo ""
echo "============================================================"
echo "Rollback Checklist"
echo "============================================================"
echo ""
echo "Manual steps to complete:"
echo "  [ ] Verify Vercel deployment is serving traffic"
echo "  [ ] Verify Supabase database is accessible"
echo "  [ ] Test Google OAuth login on Vercel"
echo "  [ ] Test GitHub OAuth login on Vercel"
echo "  [ ] Monitor error rates in Vercel dashboard"
echo "  [ ] Update status page (if applicable)"
echo ""
echo "AWS resources to keep for 30 days:"
echo "  - Aurora Serverless v2 cluster"
echo "  - Cognito User Pool"
echo "  - DMS replication instance (stopped)"
echo ""
echo "============================================================"
echo "Rollback Script Completed"
echo "============================================================"
echo "Completed at: $(date -Iseconds)"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}This was a DRY RUN - no changes were made${NC}"
fi

echo -e "${GREEN}✓ Rollback procedure completed${NC}"
echo ""
echo "Next steps:"
echo "  1. Monitor Vercel/Supabase for any issues"
echo "  2. Investigate root cause of migration failure"
echo "  3. Plan remediation before next migration attempt"
