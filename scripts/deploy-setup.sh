#!/bin/bash

# 🚀 Vow App デプロイセットアップスクリプト
# Usage: ./scripts/deploy-setup.sh

set -e

echo "🚀 Vow App デプロイセットアップを開始します..."

# 色付きログ関数
log_info() {
    echo -e "\033[34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

log_warning() {
    echo -e "\033[33m[WARNING]\033[0m $1"
}

log_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 1. 環境確認
log_info "環境確認中..."

# Node.js バージョン確認
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_success "Node.js detected: $NODE_VERSION"
    
    # Node.js 20.9.0以上かチェック
    if [[ $(echo "$NODE_VERSION" | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]]; then
        log_warning "Node.js 20.9.0以上が推奨されています。現在: $NODE_VERSION"
    fi
else
    log_error "Node.js がインストールされていません"
    exit 1
fi

# npm確認
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    log_success "npm detected: $NPM_VERSION"
else
    log_error "npm がインストールされていません"
    exit 1
fi

# 2. プロジェクト構造確認
log_info "プロジェクト構造確認中..."

if [ ! -d "frontend" ]; then
    log_error "frontend ディレクトリが見つかりません"
    exit 1
fi

if [ ! -f "frontend/package.json" ]; then
    log_error "frontend/package.json が見つかりません"
    exit 1
fi

log_success "プロジェクト構造OK"

# 3. 依存関係インストール
log_info "依存関係をインストール中..."

cd frontend

if [ -f "package-lock.json" ]; then
    log_info "既存のpackage-lock.jsonを使用してインストール..."
    npm ci
else
    log_info "新規インストール..."
    npm install
fi

log_success "依存関係インストール完了"

# 4. 環境変数確認
log_info "環境変数確認中..."

if [ ! -f ".env.local" ]; then
    log_warning ".env.local が見つかりません。テンプレートを作成します..."
    
    cat > .env.local << EOF
# Supabase設定（要更新）
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Supabase統合版設定
NEXT_PUBLIC_USE_EDGE_FUNCTIONS=false
EOF
    
    log_warning ".env.local を作成しました。Supabaseの情報で更新してください"
else
    log_success ".env.local が存在します"
    
    # 環境変数の値をチェック
    if grep -q "YOUR_PROJECT_ID" .env.local; then
        log_warning ".env.local にプレースホルダーが残っています。実際の値に更新してください"
    fi
fi

# 5. ビルドテスト
log_info "ビルドテスト実行中..."

if npm run build; then
    log_success "ビルドテスト成功"
else
    log_error "ビルドテストに失敗しました"
    log_info "以下を確認してください:"
    log_info "1. .env.local の設定"
    log_info "2. TypeScriptエラーの有無"
    log_info "3. 依存関係の問題"
    exit 1
fi

# 6. セキュリティテスト（オプション）
cd ..

if [ -f "scripts/security-test-supabase.js" ]; then
    log_info "セキュリティテストを実行しますか？ (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "セキュリティテスト実行中..."
        
        if npm run security-test-supabase; then
            log_success "セキュリティテスト成功"
        else
            log_warning "セキュリティテストに一部失敗がありました"
            log_info "本番デプロイ前に環境変数を正しく設定してください"
        fi
    fi
fi

# 7. 完了メッセージ
echo ""
log_success "🎉 デプロイセットアップ完了！"
echo ""
echo "次のステップ:"
echo "1. Supabaseプロジェクトを作成"
echo "2. frontend/.env.local を実際の値で更新"
echo "3. Google OAuth設定"
echo "4. デプロイ実行"
echo ""
echo "詳細手順: docs/deployment-guide.md"
echo "簡単チェックリスト: docs/deployment-checklist.md"
echo ""