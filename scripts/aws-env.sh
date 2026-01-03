#!/usr/bin/env bash

# IMPORTANT:
# This file is intended to be *sourced*:
#   source scripts/aws-env.sh
#
# Because it's sourced, it must never `exit` or rely on `set -euo pipefail`,
# otherwise it can terminate the caller's shell (which looks like "the terminal closed").
# We therefore run in a best-effort mode and only `return` (not `exit`) when sourced.

set +e
set +u
set +o pipefail

# VOW AWS env helper
#
# Usage:
#   source scripts/aws-env.sh
#   # or override some values:
#   PROJECT_NAME=vow STAGE=prod source scripts/aws-env.sh
#
# Notes:
# - If you use AWS SSO, set AWS_PROFILE first and run `aws sso login`.
# - This script intentionally avoids printing secrets.

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		echo "[aws-env] missing required command: $1" >&2
		return 1
	}
}

aws_env_main() {
	require_cmd aws || return 1

	# Some environments (especially when starting a fresh tmux session) can end up with
	# AWS CLI calls hanging due to SSO/device-login prompting or broken networking.
	# Keep this helper responsive by time-limiting external calls.
	# Timeout is useful to avoid hangs (SSO/device auth prompts) but can cause
	# false negatives in slow environments (STS can be a bit slow right after SSO login).
	# We therefore:
	# - keep a short timeout for cheap/config-y commands
	# - do NOT timeout STS by default
	# You can override globally via:
	#   export AWS_ENV_TIMEOUT_SECONDS=0
	local AWS_ENV_TIMEOUT_SECONDS="${AWS_ENV_TIMEOUT_SECONDS:-5}"
	aws_try() {
		if [ "${AWS_ENV_TIMEOUT_SECONDS}" = "0" ]; then
			aws "$@"
			return $?
		fi
		if command -v timeout >/dev/null 2>&1; then
			timeout "${AWS_ENV_TIMEOUT_SECONDS}s" aws "$@"
		else
			aws "$@"
		fi
	}
	aws_try_sts() {
		# STS is expected to work after sso login, but can be slower than config reads.
		aws "$@"
	}

# If AWS_PROFILE is set, AWS CLI will automatically use it.
# If it's not set (common when user ran aws with --profile manually), try to auto-detect.

local aws_profile_opt=()
if [ -n "${AWS_PROFILE:-}" ]; then
	aws_profile_opt=(--profile "$AWS_PROFILE")
fi

detect_profile() {
	# Return a usable profile name on stdout; empty if none.
	# Priority:
	#  1) SSO/permission-set-ish profile (heuristic)
	#  2) default (only if it can call STS)
	#  3) first profile in config (only if it can call STS)
	local p

	# Prefer an SSO-style profile (common pattern includes AWSReservedSSO)
	p="$(aws_try configure list-profiles 2>/dev/null | grep -E 'AdministratorAccess|PowerUserAccess|AWSReservedSSO' | head -n 1 || true)"
	if [ -n "$p" ]; then
		echo "$p"
		return 0
	fi

	# Use default only if it exists AND can call STS without interactive login
	if aws_try configure list-profiles 2>/dev/null | grep -qx 'default'; then
		if aws_try sts get-caller-identity --profile default --query Account --output text >/dev/null 2>&1; then
			echo 'default'
			return 0
		fi
	fi

	# Fallback: first profile
	p="$(aws_try configure list-profiles 2>/dev/null | head -n 1 || true)"
	if [ -n "$p" ]; then
		# Only accept if it can call STS. (Avoid picking an unusable profile and failing later.)
		if aws_try sts get-caller-identity --profile "$p" --query Account --output text >/dev/null 2>&1; then
			echo "$p"
			return 0
		fi
		return 0
	fi

	return 0
}

	if [ -z "${AWS_PROFILE:-}" ]; then
		AWS_PROFILE="$(detect_profile)"
		if [ -n "${AWS_PROFILE:-}" ]; then
			export AWS_PROFILE
		fi
	fi

	# NOTE: Don't pre-build a profile array; build it on-demand to avoid quoting issues.
	aws_profile_opt=()
	if [ -n "${AWS_PROFILE:-}" ]; then
		aws_profile_opt=(--profile "$AWS_PROFILE")
	fi

# Region: prefer existing AWS_REGION -> aws config (profile-aware) -> fallback
	# Region: prefer existing AWS_REGION -> aws config (profile-aware) -> fallback
	if [ -z "${AWS_REGION:-}" ]; then
		AWS_REGION="$(aws_try configure get region "${aws_profile_opt[@]}" 2>/dev/null || true)"
	fi
	if [ -z "${AWS_REGION:-}" ]; then
		AWS_REGION="ap-northeast-1"
	fi
	export AWS_REGION

# Account ID: prefer existing env; otherwise derive from STS
	# Account ID: prefer existing env; otherwise derive from STS
	if [ -z "${AWS_ACCOUNT_ID:-}" ]; then
		AWS_ACCOUNT_ID="$(aws_try_sts sts get-caller-identity "${aws_profile_opt[@]}" --query Account --output text 2>/dev/null || true)"
	fi
	if [ -z "${AWS_ACCOUNT_ID:-}" ] || [ "$AWS_ACCOUNT_ID" = "None" ]; then
		echo "[aws-env] failed to determine AWS_ACCOUNT_ID. Are you logged in?" >&2
		if [ -n "${AWS_PROFILE:-}" ]; then
			echo "[aws-env] try: aws sso login --profile $AWS_PROFILE" >&2
			echo "[aws-env] then: aws sts get-caller-identity --profile $AWS_PROFILE" >&2
		else
			echo "[aws-env] try: aws sts get-caller-identity" >&2
		fi
		# Don't hard-fail the caller shell. Leave AWS_ACCOUNT_ID unset.
		return 0
	fi
	export AWS_ACCOUNT_ID

# App-scoped vars (override-friendly)
	export PROJECT_NAME="${PROJECT_NAME:-vow}"
	export STAGE="${STAGE:-prod}"
	export STACK_NAME="${STACK_NAME:-$PROJECT_NAME-$STAGE}"

# ECR defaults (can be overridden)
	export ECR_REPO="${ECR_REPO:-$PROJECT_NAME-$STAGE-api}"
	export IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d)}"

# Defaults for other runbook vars (override as needed)
	export ALLOWED_CORS_ORIGIN="${ALLOWED_CORS_ORIGIN:-*}"
# Intentionally NOT defaulting DB_MASTER_PASSWORD.

# Convenience: computed ECR image uri (used later in the runbook)
	if [ -n "${AWS_ACCOUNT_ID:-}" ]; then
		export ECR_URI="${ECR_URI:-$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG}"
	fi

# CloudFormation template bucket/url helpers (non-secret)
	if [ -n "${AWS_ACCOUNT_ID:-}" ]; then
		export CFN_BUCKET="${CFN_BUCKET:-$PROJECT_NAME-$STAGE-cfn-$AWS_ACCOUNT_ID-$AWS_REGION}"
		export TEMPLATE_URL="${TEMPLATE_URL:-https://$CFN_BUCKET.s3.$AWS_REGION.amazonaws.com/template.yaml}"
	fi

# Migrate Lambda artifact key (used by CloudFormation parameter MigrateLambdaCodeS3Key)
	export MIGRATE_KEY="${MIGRATE_KEY:-$PROJECT_NAME/$STAGE/artifacts/lambda-migrate-$IMAGE_TAG.zip}"

# Derived convenience URI (non-secret). LAMBDA_ARTIFACT_BUCKET is only known after stack creation.
	if [ -n "${LAMBDA_ARTIFACT_BUCKET:-}" ]; then
		export MIGRATE_ARTIFACT_S3_URI="${MIGRATE_ARTIFACT_S3_URI:-s3://$LAMBDA_ARTIFACT_BUCKET/$MIGRATE_KEY}"
	else
		export MIGRATE_ARTIFACT_S3_URI="${MIGRATE_ARTIFACT_S3_URI:-<set LAMBDA_ARTIFACT_BUCKET after stack create>}"
	fi

# Sanity summary
	cat <<EOF
[aws-env] loaded
	AWS_PROFILE=${AWS_PROFILE:-<default>}
	AWS_REGION=${AWS_REGION:-}
	AWS_ACCOUNT_ID=${AWS_ACCOUNT_ID:-}
	PROJECT_NAME=${PROJECT_NAME:-}
	STAGE=${STAGE:-}
	STACK_NAME=${STACK_NAME:-}
	ECR_URI=${ECR_URI:-}
	CFN_BUCKET=${CFN_BUCKET:-}
	TEMPLATE_URL=${TEMPLATE_URL:-}
	MIGRATE_ARTIFACT_S3_URI=${MIGRATE_ARTIFACT_S3_URI:-}
	MIGRATE_KEY=${MIGRATE_KEY:-}
EOF

	return 0
}

# If executed directly, run. If sourced, also run without killing the parent shell.
aws_env_main
