# Design Document

## Overview

ゲストユーザーがHabit/Goal登録を行えるようにする最小限の変更です。既存のデータ層は既にゲスト対応済みのため、認証フック（useAuth）でゲストユーザーを「認証済み」として扱うよう変更するだけです。

## Architecture

### 問題の特定

現在の状況：
- データ層（supabase-direct.ts）: ✅ ゲスト対応済み
- UI層（Modal.Goal.tsx, Modal.Habit.tsx）: ✅ 認証チェックなし
- 認証層（useAuth.ts）: ❌ ゲストユーザーを`isAuthed: false`に設定

### 解決方法

**useAuth.tsの1箇所のみ修正**

```typescript
// 現在: ゲストユーザーは isAuthed: false
// 修正後: ゲストユーザーは isAuthed: true (ローカルデータがある場合)
```

## Components and Interfaces

### useAuth フックの修正

**変更箇所**: `frontend/app/dashboard/hooks/useAuth.ts`の認証判定ロジック

**修正内容**:
```typescript
// 現在のロジック
if (a?.type === 'guest') {
  setActorLabel(`guest:${a.id}`);
  setIsAuthed(false); // ← これを修正
}

// 修正後のロジック  
if (a?.type === 'guest') {
  setActorLabel(`guest:${a.id}`);
  setIsAuthed(true); // ← ゲストユーザーも認証済みとして扱う
}
```

### Guest Data Migration Service

**新規追加**: `frontend/lib/guest-data-migration.ts`

ゲストユーザーがログイン時にローカルデータをSupabaseに統合するサービス

**主要機能**:
1. ローカルストレージからゲストデータを読み取り
2. GoalsをSupabaseに保存し、IDマッピングを作成
3. HabitsをSupabaseに保存し、goalId参照を更新
4. ActivitiesをSupabaseに保存（habit名で関連付け）
5. 統合完了後にローカルデータをクリア
6. エラーハンドリングと進捗通知

**インターフェース**:
```typescript
class GuestDataMigration {
  static async migrateGuestDataToSupabase(userId: string): Promise<GuestDataMigrationResult>
  static hasGuestData(): boolean
  private static async migrateGoals(userId: string, result: GuestDataMigrationResult): Promise<Map<string, string>>
  private static async migrateHabits(userId: string, goalIdMapping: Map<string, string>, result: GuestDataMigrationResult)
  private static async migrateActivities(userId: string, result: GuestDataMigrationResult)
  private static clearGuestData(): void
}

interface GuestDataMigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}
```

**重要な実装詳細**:
- ゲストGoalのローカルIDとSupabaseで生成されたUUIDのマッピングを保持
- HabitのgoalId参照を正しいSupabase IDに更新
- 部分的な失敗時はゲストデータを保持し、詳細なエラー情報を提供

### Authentication Flow Integration

**修正箇所**: `useAuth.ts`の認証状態変更監視

ユーザーがゲストから認証ユーザーに変わった際に、自動的にデータ統合を実行する仕組みを追加

## Data Models

**変更なし** - 既存のデータモデルをそのまま使用

ゲストデータは既にsupabase-direct.tsで以下のキーでローカルストレージに保存済み：
- `guest-goals`: Goal[]
- `guest-habits`: Habit[]  
- `guest-activities`: Activity[]

### Guest Data Migration Model

**新規追加**: ゲストデータ統合のためのデータ構造

```typescript
interface MigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}

interface MigrationStatus {
  inProgress: boolean;
  completed: boolean;
  result?: MigrationResult;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property-Based Testing Properties

Property 1: Guest user authentication state
*For any* guest user with local data, the Auth_Hook should set isAuthed to true to enable habit/goal features
**Validates: Requirements 1.1**

Property 2: Backward compatibility preservation  
*For any* existing authenticated user flow, the system should maintain exactly the same behavior as before
**Validates: Requirements 1.4**

Property 3: Guest goal creation
*For any* valid goal data created by a guest user, it should be accessible in subsequent goal retrievals
**Validates: Requirements 2.1, 2.2**

Property 4: Guest habit creation
*For any* valid habit data created by a guest user, it should be accessible in subsequent habit retrievals  
**Validates: Requirements 3.1, 3.2**

Property 5: Data migration with ID mapping
*For any* guest user with goals and habits who logs in, the migrated habits should reference the correct Supabase goal IDs, not the original guest goal IDs
**Validates: Requirements 7.3, 7.4**

Property 6: Data migration cleanup
*For any* successful data migration, the local storage should be cleared of guest data after transfer completion
**Validates: Requirements 7.6**

Property 7: Migration error preservation
*For any* migration failure, guest data should remain intact in local storage and detailed error information should be provided to the user
**Validates: Requirements 7.7**

Property 8: Duplicate data handling
*For any* migration attempt, the system should check for existing user data and avoid creating duplicates
**Validates: Requirements 7.8**

## Error Handling

### 認証状態の誤判定防止
- ゲストユーザーの判定ロジックを慎重に実装
- 既存の認証ユーザーに影響を与えないよう条件分岐を明確化

## Testing Strategy

### 重点テスト項目
1. **既存機能の回帰テスト**: 認証ユーザーの動作が変わらないことを確認
2. **ゲスト機能テスト**: ゲストユーザーがGoal/Habit作成できることを確認
3. **認証状態テスト**: 適切な認証状態が設定されることを確認

### Property-Based Testing Configuration
- Use Jest with fast-check library for TypeScript
- Minimum 100 iterations per property test
- Tag format: **Feature: guest-user-habit-goal-support, Property {number}: {property_text}**