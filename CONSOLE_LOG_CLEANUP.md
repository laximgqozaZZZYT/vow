# Console.log Cleanup - GitHub Actions Error Fix

## 問題
GitHub Actionsで大量のconsole.logがテスト出力を汚染し、ログが読みにくくなっていました。

## 解決策
1. **デバッグユーティリティの作成** (`frontend/lib/debug.ts`)
   - CI/テスト環境でconsole.logを自動的に抑制
   - 開発環境では通常通り動作
   - 環境変数`DEBUG=true`で明示的に有効化可能

2. **全ファイルのconsole.log置き換え**
   - `console.log()` → `debug.log()`
   - `console.warn()` → `debug.warn()`
   - `console.error()` は常に出力（エラーは重要）

3. **GitHub Actions設定の更新**
   - `CI=true`と`DEBUG=false`を環境変数に追加
   - テストとビルドステップで自動的にログを抑制

4. **Jest設定の更新**
   - CI環境で`silent: true`を設定
   - テスト出力をクリーンに保つ

## 修正されたファイル
- `frontend/lib/debug.ts` (新規作成)
- `frontend/lib/api.ts`
- `frontend/lib/supabase-direct.ts`
- `frontend/lib/supabaseClient.ts`
- `frontend/lib/guest-data-migration.ts`
- `frontend/app/dashboard/hooks/useAuth.ts`
- `frontend/app/dashboard/hooks/useActivityManager.ts`
- `frontend/app/dashboard/hooks/useEventHandlers.ts`
- `frontend/app/dashboard/hooks/useDataManager.ts`
- `frontend/app/dashboard/utils/animationCapture.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/components/Section.Activity.tsx`
- `frontend/app/dashboard/components/Section.Diary.tsx`
- `frontend/app/dashboard/components/Modal.Habit.tsx`
- `frontend/app/dashboard/components/Widget.Calendar.tsx`
- `frontend/app/dashboard/components/Widget.Mindmap.tsx`
- `frontend/app/dashboard/components/AnimationCaptureControl.tsx`
- `frontend/app/dashboard/hooks/useLocalStorage.ts`
- `frontend/jest.config.js`
- `.github/workflows/deploy.yml`

## 使用方法
### 開発環境
通常通りconsole.logが表示されます。

### CI/テスト環境
デフォルトでログが抑制されます。デバッグが必要な場合：
```bash
DEBUG=true npm test
```

### ブラウザでのデバッグ
```javascript
localStorage.setItem('DEBUG', 'true');
// ページをリロード
```

## 結果
- GitHub Actionsのログが大幅にクリーンになりました
- ビルドとテストが正常に動作します
- 開発体験は変わりません
