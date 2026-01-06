# Supabase パスワード保護有効化ガイド

## 問題
Supabaseダッシュボードで「Leaked Password Protection is currently disabled」警告が表示されている。

## 対処方法

### 1. Supabaseダッシュボードでの設定

1. **Authentication設定にアクセス**
   - Supabaseダッシュボード → Authentication → Settings

2. **Password Protection設定**
   - "Password Protection" セクションを探す
   - "Enable password leak detection" を有効化
   - "Minimum password strength" を設定（推奨: Strong）

3. **追加のセキュリティ設定**
   - "Enable email confirmations" を有効化
   - "Enable phone confirmations" を有効化（必要に応じて）
   - "Session timeout" を適切に設定（推奨: 24時間以下）

### 2. パスワードポリシーの強化

```javascript
// フロントエンドでのパスワード検証例
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
    errors: [
      ...(password.length < minLength ? [`最低${minLength}文字必要`] : []),
      ...(!hasUpperCase ? ['大文字を含む必要があります'] : []),
      ...(!hasLowerCase ? ['小文字を含む必要があります'] : []),
      ...(!hasNumbers ? ['数字を含む必要があります'] : []),
      ...(!hasSpecialChar ? ['特殊文字を含む必要があります'] : [])
    ]
  };
}
```

### 3. 設定確認

設定後、以下を確認してください：

1. **ダッシュボード確認**
   - Security Advisor で警告が消えていることを確認

2. **機能テスト**
   - 新規ユーザー登録で弱いパスワードが拒否されることを確認
   - 既存ユーザーのパスワード変更が適切に動作することを確認

3. **ログ確認**
   - Authentication → Logs でエラーがないことを確認

## 注意事項

- パスワード保護を有効化すると、既存の弱いパスワードを持つユーザーに影響する可能性があります
- ユーザーに事前通知を行い、パスワード更新を促すことを推奨します
- 段階的に強度を上げることを検討してください

## 追加のセキュリティ対策

1. **多要素認証（MFA）の有効化**
2. **ソーシャルログインの活用**
3. **定期的なセキュリティ監査**
4. **異常なログイン試行の監視**