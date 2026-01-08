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

## Data Models

**変更なし** - 既存のデータモデルをそのまま使用

ゲストデータは既にsupabase-direct.tsで以下のキーでローカルストレージに保存済み：
- `guest-goals`: Goal[]
- `guest-habits`: Habit[]  
- `guest-activities`: Activity[]

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