#!/usr/bin/env bash
# =================================================================
# VOW Project — Secrets Rotation Runbook
# =================================================================
# セキュリティ監査に基づくシークレットローテーション手順
#
# 使い方: このスクリプトを読みながら、各ステップを手動で実行してください。
# 自動実行されるステップと、手動操作が必要なステップがあります。
#
# 前提条件:
# - git filter-repo がインストール済み (pip install git-filter-repo)
# - AWS CLIが設定済み
# - 各サービスの管理コンソールへのアクセス権
# =================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== VOW Secrets Rotation Runbook ===${NC}"
echo ""

# =================================================================
# Phase 1: Git履歴クリーニング（最重要・最初に実行）
# =================================================================
phase1_git_cleanup() {
    echo -e "${RED}=== Phase 1: Git履歴クリーニング ===${NC}"
    echo ""
    echo "WARNING: この操作はGit履歴を書き換えます。"
    echo "WARNING: 全コラボレーターにforce pullが必要になります。"
    echo ""

    read -p "続行しますか？ (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "スキップしました。"
        return
    fi

    cd ~/Downloads/vow

    # バックアップ
    echo -e "${YELLOW}1. バックアップ作成中...${NC}"
    BACKUP_DIR="$HOME/vow-backup-$(date +%Y%m%d%H%M%S)"
    cp -r . "$BACKUP_DIR"
    echo -e "${GREEN}   バックアップ: $BACKUP_DIR${NC}"

    # filter-repoで機密ファイルを履歴から除去
    echo -e "${YELLOW}2. git filter-repo 実行中...${NC}"
    echo "   対象ファイル:"
    echo "   - infra/terraform/terraform.tfvars"
    echo "   - infra/terraform/terraform.development.tfvars"
    echo "   - infra/terraform/.env.terraform"
    echo "   - frontend/.env.local"
    echo ""

    git filter-repo \
        --invert-paths \
        --path infra/terraform/terraform.tfvars \
        --path infra/terraform/terraform.development.tfvars \
        --path infra/terraform/.env.terraform \
        --path frontend/.env.local \
        --force

    echo -e "${GREEN}   Git履歴クリーニング完了${NC}"

    # リモートを再追加（filter-repoはoriginを削除する）
    echo -e "${YELLOW}3. リモート再設定...${NC}"
    git remote add origin git@github.com:laximgqozaZZZYT/vow.git || true

    echo -e "${RED}4. 以下のコマンドを手動で実行してください:${NC}"
    echo ""
    echo "   git push origin --force --all"
    echo "   git push origin --force --tags"
    echo ""
    echo "   全コラボレーターに以下を依頼:"
    echo "   git fetch origin"
    echo "   git reset --hard origin/\$(git branch --show-current)"
}

# =================================================================
# Phase 2: シークレットローテーション
# =================================================================
phase2_rotate_secrets() {
    echo ""
    echo -e "${RED}=== Phase 2: シークレットローテーション ===${NC}"
    echo ""
    echo "以下の順番でシークレットをローテーションしてください。"
    echo "各サービスのダッシュボードで新しいキーを生成後、"
    echo "terraform.tfvarsとAWS Lambda環境変数を更新します。"
    echo ""

    # 2.1 GitHub PAT
    echo -e "${YELLOW}2.1 GitHub Personal Access Token${NC}"
    echo "   1. https://github.com/settings/tokens にアクセス"
    echo "   2. 漏洩したトークンを「Revoke」"
    echo "   3. 新しいFine-grained PATを作成（必要最小限の権限）"
    echo "   4. .env.terraform の GITHUB_ACCESS_TOKEN を更新"
    echo "   5. terraform.tfvars の github_access_token を更新"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.2 Supabase
    echo -e "${YELLOW}2.2 Supabase Keys${NC}"
    echo "   1. https://supabase.com/dashboard にアクセス"
    echo "   2. Project Settings -> API -> Regenerate API Keys"
    echo "   WARNING: anon key と service_role_key の両方が変わります"
    echo "   3. terraform.tfvars 更新:"
    echo "      - supabase_anon_key"
    echo "      - supabase_service_role_key"
    echo "   4. Amplify環境変数も更新:"
    echo "      - NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "   5. Lambda環境変数も更新（terraform applyで反映）"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.3 Stripe
    echo -e "${YELLOW}2.3 Stripe Keys${NC}"
    echo "   1. https://dashboard.stripe.com/apikeys にアクセス"
    echo "   2. Secret Key -> 「Roll key」"
    echo "   3. Webhook -> Signing Secret を確認（Webhook再作成が必要な場合あり）"
    echo "   4. terraform.tfvars 更新:"
    echo "      - stripe_secret_key"
    echo "      - stripe_webhook_secret"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.4 Slack
    echo -e "${YELLOW}2.4 Slack App Credentials${NC}"
    echo "   1. https://api.slack.com/apps にアクセス"
    echo "   2. VOWアプリ -> Basic Information"
    echo "   3. Client Secret -> 「Regenerate」"
    echo "   4. Signing Secret -> 「Regenerate」"
    echo "   5. terraform.tfvars 更新:"
    echo "      - slack_client_secret"
    echo "      - slack_signing_secret"
    echo "   注意: slack_client_id は変更不要"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.5 OpenAI
    echo -e "${YELLOW}2.5 OpenAI API Key${NC}"
    echo "   1. https://platform.openai.com/api-keys にアクセス"
    echo "   2. 漏洩したキーを「Delete」"
    echo "   3. 新しいキーを作成"
    echo "   4. terraform.tfvars 更新:"
    echo "      - openai_api_key"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.6 JWT Secret
    echo -e "${YELLOW}2.6 JWT Secret${NC}"
    echo "   新しいJWTシークレットを生成します..."
    NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    echo "   新しいJWT Secret: ${NEW_JWT_SECRET:0:20}..."
    echo "   terraform.tfvars の jwt_secret を更新してください"
    echo "   WARNING: 全ユーザーのセッションが無効化されます"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.7 Token Encryption Key
    echo -e "${YELLOW}2.7 Token Encryption Key (Fernet)${NC}"
    echo "   WARNING: このキーを変更すると、既存のSlackトークンが復号できなくなります"
    echo "   WARNING: ユーザーにSlack再連携を依頼する必要があります"
    echo ""
    echo "   新しいFernetキーの生成:"
    echo "   python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    echo ""
    echo "   terraform.tfvars の token_encryption_key を更新"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.8 Credentials Encryption Key
    echo -e "${YELLOW}2.8 Credentials Encryption Key${NC}"
    echo "   新しい暗号化キーを生成します..."
    NEW_CRED_KEY=$(openssl rand -base64 32 | tr -d '\n')
    echo "   新しいキー: ${NEW_CRED_KEY:0:20}..."
    echo "   terraform.tfvars の credentials_encryption_key を更新"
    echo "   WARNING: DynamoDBの既存暗号化データが復号不可になります"
    echo ""
    read -p "   完了したらEnterを押してください..."

    # 2.9 DB Password
    echo -e "${YELLOW}2.9 Database Password${NC}"
    echo "   Supabaseの場合: Database Settings -> Connection pooling"
    echo "   パスワードは通常Supabase管理下なので変更不要"
    echo "   ただし .env.terraform に平文があった場合はSupabaseで再設定"
    echo ""
    read -p "   完了したらEnterを押してください..."
}

# =================================================================
# Phase 3: 反映とテスト
# =================================================================
phase3_apply() {
    echo ""
    echo -e "${BLUE}=== Phase 3: 変更を反映 ===${NC}"
    echo ""
    echo "1. terraform.tfvars に全ての新しいシークレットが設定されていることを確認"
    echo ""
    echo "2. Terraform適用:"
    echo "   cd ~/Downloads/vow/infra/terraform"
    echo "   terraform plan -var-file=terraform.tfvars"
    echo "   terraform apply -var-file=terraform.tfvars"
    echo ""
    echo "3. Lambda環境変数が更新されたことを確認:"
    echo "   aws lambda get-function-configuration \\"
    echo "     --function-name vow-production-hono-api \\"
    echo "     --query 'Environment.Variables' \\"
    echo "     --region ap-northeast-1"
    echo ""
    echo "4. ヘルスチェック:"
    echo "   curl https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/production/health"
    echo ""
    echo "5. フロントエンド動作確認:"
    echo "   https://main.do1k9oyyorn24.amplifyapp.com/dashboard"
    echo ""
    echo "6. 各機能テスト:"
    echo "   - ログイン/ログアウト"
    echo "   - Slack連携"
    echo "   - AIコーチ"
    echo "   - Stripe決済"
    echo ""
}

# =================================================================
# Phase 4: .gitignore確認
# =================================================================
phase4_gitignore() {
    echo ""
    echo -e "${BLUE}=== Phase 4: .gitignore 確認 ===${NC}"
    echo ""

    cd ~/Downloads/vow

    # チェック対象ファイルが.gitignoreに含まれているか確認
    SENSITIVE_FILES=(
        "infra/terraform/terraform.tfvars"
        "infra/terraform/terraform.development.tfvars"
        "infra/terraform/.env.terraform"
        "frontend/.env.local"
        "frontend/.env"
        ".env"
    )

    for f in "${SENSITIVE_FILES[@]}"; do
        if git check-ignore -q "$f" 2>/dev/null; then
            echo -e "  ${GREEN}[OK] $f は .gitignore に含まれています${NC}"
        else
            echo -e "  ${RED}[NG] $f は .gitignore に含まれていません！追加してください${NC}"
        fi
    done
}

# =================================================================
# メイン
# =================================================================
echo "実行するフェーズを選択してください:"
echo "  1) Git履歴クリーニング（Phase 1）"
echo "  2) シークレットローテーション（Phase 2）"
echo "  3) 反映とテスト（Phase 3）"
echo "  4) .gitignore確認（Phase 4）"
echo "  a) 全て実行"
echo ""
read -p "選択 (1/2/3/4/a): " choice

case "$choice" in
    1) phase1_git_cleanup ;;
    2) phase2_rotate_secrets ;;
    3) phase3_apply ;;
    4) phase4_gitignore ;;
    a)
        phase1_git_cleanup
        phase2_rotate_secrets
        phase3_apply
        phase4_gitignore
        ;;
    *)
        echo "無効な選択です"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}=== 完了 ===${NC}"
echo "すべてのフェーズが完了したことを確認してください。"
