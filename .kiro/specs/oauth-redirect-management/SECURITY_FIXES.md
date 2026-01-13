# OAuth セキュリティ修正提案

## 重大な修正が必要な項目

### 1. Client Secret のハッシュ化
```sql
-- 修正前
client_secret VARCHAR(255) NOT NULL

-- 修正後  
client_secret_hash VARCHAR(255) NOT NULL, -- bcryptハッシュ
salt VARCHAR(255) NOT NULL
```

### 2. 認可コード再利用防止の強化
```typescript
interface AuthorizationCodeValidation {
  validateCode(code: string): Promise<{
    isValid: boolean
    isUsed: boolean
    isExpired: boolean
    clientId: string
  }>
  
  markCodeAsUsed(code: string): Promise<void>
}
```

### 3. PKCE 必須化
```typescript
interface PKCERequirement {
  // パブリッククライアントではPKCE必須
  requirePKCE: boolean
  // コードチャレンジメソッドはS256のみ許可
  allowedMethods: ['S256']
}
```

### 4. レート制限の具体化
```typescript
interface RateLimitConfig {
  authorizationAttempts: {
    limit: 10,
    window: '1m'  // 1分間
  }
  tokenRequests: {
    limit: 5,
    window: '1m'
  }
  apiCalls: {
    limit: 1000,
    window: '1h'  // 1時間
  }
}
```

### 5. トークンセキュリティ強化
```typescript
interface SecureTokenConfig {
  // JWTトークンの使用
  useJWT: true
  // トークンの暗号化
  encryptTokens: true
  // 短期間のアクセストークン
  accessTokenTTL: '15m'  // 15分に短縮
  // リフレッシュトークンローテーション
  rotateRefreshTokens: true
}
```

### 6. 監査ログセキュリティ
```sql
-- 監査ログテーブルの修正
CREATE TABLE oauth_auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(255),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  ip_address INET,
  user_agent_hash VARCHAR(255), -- ハッシュ化
  success BOOLEAN NOT NULL,
  error_message TEXT,
  log_hash VARCHAR(255) NOT NULL, -- 改ざん防止
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- ログの削除を防ぐ
  CONSTRAINT no_delete_logs CHECK (false) -- 削除禁止
);
```

## 追加のセキュリティ要件

### 7. セキュリティヘッダー
```typescript
interface SecurityHeaders {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  'X-Content-Type-Options': 'nosniff'
  'X-Frame-Options': 'DENY'
  'X-XSS-Protection': '1; mode=block'
  'Content-Security-Policy': "default-src 'self'"
}
```

### 8. 入力検証の強化
```typescript
interface InputValidation {
  // リダイレクトURIの厳密検証
  validateRedirectURI(uri: string): {
    isValid: boolean
    isHTTPS: boolean
    hasValidDomain: boolean
    hasNoFragments: boolean
  }
  
  // SQLインジェクション防止
  sanitizeInput(input: string): string
  
  // XSS防止
  escapeHTML(input: string): string
}
```

### 9. 暗号化の強化
```typescript
interface CryptographicConfig {
  // 強力な暗号化アルゴリズム
  encryptionAlgorithm: 'AES-256-GCM'
  // セキュアな乱数生成
  randomGenerator: 'crypto.randomBytes'
  // ハッシュアルゴリズム
  hashAlgorithm: 'SHA-256'
}
```

### 10. セッション管理
```typescript
interface SessionSecurity {
  // セッションタイムアウト
  sessionTimeout: '30m'
  // セッション固定攻撃防止
  regenerateSessionId: true
  // セキュアクッキー
  secureCookies: true
  httpOnlyCookies: true
  sameSiteCookies: 'strict'
}
```

## 実装優先度

### 🔴 最優先（実装前に必須）
1. Client Secret ハッシュ化
2. 認可コード再利用防止
3. PKCE 必須化
4. レート制限実装

### 🟡 高優先（MVP後すぐに実装）
5. トークン暗号化
6. 監査ログセキュリティ
7. セキュリティヘッダー

### 🟢 中優先（段階的実装）
8. 入力検証強化
9. 暗号化強化
10. セッション管理

## セキュリティテスト要件

### ペネトレーションテスト項目
- [ ] 認可コード再利用攻撃
- [ ] PKCE バイパス攻撃
- [ ] トークン傍受攻撃
- [ ] SQLインジェクション
- [ ] XSS攻撃
- [ ] CSRF攻撃
- [ ] レート制限バイパス
- [ ] 権限昇格攻撃

### 自動セキュリティテスト
```typescript
// セキュリティプロパティテスト例
describe('Security Properties', () => {
  test('Authorization codes cannot be reused', async () => {
    // プロパティ: 使用済み認可コードは再利用不可
  })
  
  test('PKCE is required for public clients', async () => {
    // プロパティ: パブリッククライアントはPKCE必須
  })
  
  test('Rate limits are enforced', async () => {
    // プロパティ: レート制限が適切に動作
  })
})
```