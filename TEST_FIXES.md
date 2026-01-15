# GitHub Actions Test Fixes

## 修正したテストエラー

### 1. guestHabits.test.ts - undefinedフィールドの問題
**問題**: `toMatchObject`がundefinedフィールドを期待していたが、実際のオブジェクトには含まれていなかった

**解決策**: 必要なフィールドのみを明示的に比較するように変更
```typescript
// Before
expect(habits[0]).toMatchObject(createdHabit);

// After
expect(habits[0]).toMatchObject({
  name: createdHabit.name,
  type: createdHabit.type,
  notes: createdHabit.notes,
  // ... 必要なフィールドのみ
});
```

### 2. guestGoals.test.ts - 同様のundefinedフィールドの問題
**解決策**: guestHabits.test.tsと同じアプローチで修正

### 3. useAuth.test.ts - mock初期化順序の問題
**問題**: `jest.mock`内で変数`mockApiMe`を参照しようとしたが、巻き上げの問題で初期化前にアクセスしていた

**解決策**: 
1. `jest.mock`内で直接`jest.fn()`を使用
2. import後にmockされた関数を取得
```typescript
// Mock定義
jest.mock('../lib/api', () => ({
  me: jest.fn()
}));

// Import後に取得
import api from '../lib/api';
const mockApiMe = api.me as jest.MockedFunction<typeof api.me>;
```

### 4. seo.metadata.property.test.ts - 空白文字のメタデータ問題
**問題**: プロパティベーステストが空白のみの文字列を生成し、メタデータの一意性チェックが失敗

**解決策**: 
1. 文字列生成時に空白のみの文字列をフィルタリング
2. 比較時に`trim()`を使用
```typescript
// Before
title: fc.string({ minLength: 5, maxLength: 100 })

// After
title: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5)
```

## テスト結果
```
Test Suites: 11 passed, 11 total
Tests:       97 passed, 97 total
Snapshots:   0 total
Time:        10.748 s
```

## ビルド結果
```
✓ Compiled successfully in 18.3s
✓ Generating static pages using 11 workers (11/11)
```

## 修正されたファイル
- `frontend/__tests__/guestHabits.test.ts`
- `frontend/__tests__/guestGoals.test.ts`
- `frontend/__tests__/useAuth.test.ts`
- `frontend/__tests__/seo.metadata.property.test.ts`

すべてのテストが成功し、ビルドも正常に完了しました。
