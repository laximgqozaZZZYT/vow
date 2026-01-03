#!/usr/bin/env bash
set -euo pipefail

# cfn-triage.sh
# Quick CloudFormation troubleshooting helper for this repo.
#
# Usage:
#   AWS_REGION=ap-northeast-1 STACK_NAME=vow-prod scripts/cfn-triage.sh

if [[ -z "${AWS_REGION:-}" || -z "${STACK_NAME:-}" ]]; then
  echo "Usage: AWS_REGION=<region> STACK_NAME=<stack> $0" >&2
  exit 2
fi

aws cloudformation describe-stacks \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "Stacks[0].[StackStatus,StackStatusReason,CreationTime,LastUpdatedTime]" \
  --output table || true

echo
echo "== First CREATE_FAILED (root cause) =="
aws cloudformation describe-stack-events \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[Timestamp,LogicalResourceId,ResourceType,ResourceStatusReason] | sort_by(@,&[0]) | [0:5]" \
  --output table || true

echo
echo "== Current DELETE_FAILED (if any) =="
aws cloudformation describe-stack-events \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query "StackEvents[?ResourceStatus=='DELETE_FAILED'].[Timestamp,LogicalResourceId,ResourceType,ResourceStatusReason]" \
  --output table || true

echo
echo "== Recent DELETE_IN_PROGRESS (top 25) =="
aws cloudformation describe-stack-events \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --max-items 25 \
  --query "StackEvents[?ResourceStatus=='DELETE_IN_PROGRESS'].[Timestamp,LogicalResourceId,ResourceType]" \
  --output table || true
