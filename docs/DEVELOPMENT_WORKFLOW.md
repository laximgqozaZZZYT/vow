# VOW 開発ワークフロー

## 環境構成

| 環境 | フロントエンド | バックエンド/DB | URL |
|------|---------------|----------------|-----|
| 本番 | Vercel | Supabase | vow-app.vercel.app |
| 開発 | AWS Amplify | Supabase (共有) | https://develop.d1zmna50iwo9dv.amplifyapp.com |
| 将来 | AWS Amplify | Aurora Serverless v2 | (移行後) |

## Git ブランチ戦略

```
main ─────────────────────────► Vercel (本番) 自動デプロイ
  │
  └── develop ────────────────► Amplify (開発) 自動デプロイ
        │
        └── feature/* ────────► ローカル開発
```

## 日常の開発フロー

### 1. 機能開発開始

```bash
git checkout develop
git pull origin develop
git checkout -b feature/新機能名
```

### 2. ローカル開発

```bash
cd frontend
npm run dev  # localhost:3000
```

### 3. 開発環境で確認

```bash
git push origin feature/新機能名
# GitHub でPRを作成 → developにマージ → Amplifyが自動ビルド
```

### 4. 本番リリース

```bash
# develop → main へPR作成・マージ → Vercelが自動デプロイ
```

## 環境変数の管理

| 変数 | ローカル | Amplify (開発) | Vercel (本番) |
|------|---------|----------------|---------------|
| 設定場所 | `.env.local` | AWS Console | Vercel Dashboard |
| Supabase URL | 共通 | 共通 | 共通 |

### Amplify 環境変数の更新

```bash
aws amplify update-branch \
  --app-id d1zmna50iwo9dv \
  --branch-name develop \
  --environment-variables KEY=VALUE
```

### 現在設定済みの環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_USE_SUPABASE_API`
- `NEXT_PUBLIC_USE_EDGE_FUNCTIONS`
- `NEXT_PUBLIC_SITE_URL`

## AWS インフラ情報

### Terraform で管理中のリソース

| リソース | 状態 | 用途 |
|---------|------|------|
| VPC | 稼働中 | ネットワーク基盤 |
| Aurora Serverless v2 | 稼働中 (未使用) | 将来のDB移行先 |
| Cognito User Pool | 稼働中 (未使用) | 将来の認証基盤 |
| Lambda + API Gateway | 未デプロイ | バックエンドAPI |

### Terraform コマンド

```bash
cd infra/terraform
~/.local/bin/terraform plan    # 変更確認
~/.local/bin/terraform apply   # 適用
~/.local/bin/terraform output  # 出力値確認
```

### Aurora 接続情報

```bash
# エンドポイント取得
~/.local/bin/terraform output aurora_cluster_endpoint

# シークレット取得 (AWS Secrets Manager)
~/.local/bin/terraform output aurora_secret_arn
```

## 注意事項

- 現在は開発/本番で同じSupabaseを共有しているため、データは共通
- Aurora DBは稼働中だが未使用（月額コスト発生中）
- 本番環境 (Vercel) への影響を避けるため、mainブランチへの直接pushは禁止

## 将来のAWS完全移行

Aurora DBへの移行準備は完了:

1. 環境変数を Aurora 接続情報に切り替え
2. Supabase → Aurora へデータ移行
3. 認証を Cognito に切り替え（オプション）


---

## クラウドIDE環境の選択肢

個人開発者向けにIDEもクラウド化する場合の選択肢を比較します。

### 選択肢比較

| サービス | 無料枠 | 有料プラン | 特徴 |
|---------|--------|-----------|------|
| **Kiro + EC2 Remote SSH** | Kiro Free: 50クレジット/月 | EC2: ~$17/月 + Kiro Pro: $20/月 | Kiro の AI 機能をフル活用 |
| **Kiro IDE Remote (AWS)** | なし | EC2 + EBS: ~$20-30/月 | ブラウザからアクセス可能 |
| **GitHub Codespaces** | 120時間/月 (2コア) + 15GB | 超過分: $0.18/時間 | VS Code完全互換、GitHub統合 |
| **Gitpod** | 50時間/月 | $9/月 (1000クレジット) | オープンソース、GitLab/Bitbucket対応 |
| **AWS Cloud9** | EC2料金のみ | t3.micro: ~$8/月 | AWS統合、Lambda開発に最適 |

---

## Kiro をクラウドで使う方法

### 方法1: Kiro + EC2 Remote SSH (推奨)

ローカルの Kiro から EC2 インスタンスに SSH 接続して開発する方法。

**メリット**:
- Kiro の AI 機能 (Specs, Hooks, Powers) をフル活用
- ローカル Kiro の設定・拡張機能がそのまま使える
- EC2 を停止すればコスト削減可能

**コスト見積もり**:
| 項目 | 月額 |
|------|------|
| Kiro Free | $0 (50クレジット/月) |
| EC2 t3.small (2GB RAM) | ~$17/月 |
| EBS 30GB | ~$3/月 |
| **合計** | **~$20/月** |

**セットアップ手順**:

1. EC2 インスタンスを作成 (Ubuntu 22.04, t3.small)
2. SSH キーペアを設定
3. Kiro で Remote SSH 拡張機能をインストール
4. SSH 設定ファイルを作成:

```
# ~/.ssh/config
Host vow-dev
    HostName <EC2_PUBLIC_IP>
    User ubuntu
    IdentityFile ~/.ssh/vow-dev-key.pem
```

5. Kiro のコマンドパレットから「Remote-SSH: Connect to Host」→「vow-dev」

### 方法2: Kiro IDE Remote (ブラウザアクセス)

AWS が提供する CloudFormation テンプレートで、ブラウザから Kiro にアクセス。

**メリット**:
- ローカルに Kiro をインストール不要
- どのデバイスからでもアクセス可能
- AWS CLI, SAM CLI がプリインストール済み

**デメリット**:
- EC2 を常時起動する必要がある
- コストが高め (~$30/月)

**デプロイ方法**:
https://aws-samples.github.io/sample-one-click-generative-ai-solutions/en/solutions/kiro-ide/

### 方法3: ローカル Kiro + GitHub Codespaces (ハイブリッド)

軽量な作業は Codespaces、AI 機能が必要な作業はローカル Kiro。

**コスト**: $0 (無料枠内)

---

## 推奨構成: Kiro + EC2 Remote SSH

**理由**:
- Kiro の Specs/Hooks/Powers 機能をフル活用できる
- EC2 を停止すれば使わない時間のコストを削減
- 既存の Terraform インフラと統合しやすい

### Kiro 料金プラン (2026年1月時点)

| プラン | 月額 | クレジット | 備考 |
|--------|------|-----------|------|
| Free | $0 | 50/月 | 個人利用に十分 |
| Pro | $20 | 1,000/月 | 超過: $0.04/クレジット |
| Pro+ | $40 | 2,000/月 | 超過: $0.04/クレジット |
| Power | $200 | 10,000/月 | 大規模開発向け |

**注意**: 新規登録時に 500 ボーナスクレジット (30日間有効) が付与されます。

---

## コスト比較まとめ

| 構成 | 月額コスト | Kiro AI機能 | 備考 |
|------|-----------|-------------|------|
| ローカル Kiro のみ | $0 | ✅ | 現在の構成 |
| Kiro + EC2 Remote SSH | ~$20 | ✅ | クラウド開発推奨 |
| Kiro IDE Remote (ブラウザ) | ~$30 | ✅ | どこからでもアクセス |
| GitHub Codespaces | $0 | ❌ | Kiro 機能なし |

**結論**: Kiro の AI 機能を活かしたクラウド開発なら **Kiro + EC2 Remote SSH (~$20/月)** が最もコスパが良いです。
