# タグ機能実装ガイド

## 概要

Habit、Goal、Diary Card（Note）に複数のタグを付与できる統合タグシステムを実装しました。この機能により、タグベースのフィルタリングや分類が可能になります。

## データベース設計

### テーブル構造

#### 1. `tags` テーブル（共通タグマスター）
```sql
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(owner_type, owner_id, name)
);
```

#### 2. `entity_tags` テーブル（汎用的なエンティティとタグの関連）
```sql
CREATE TABLE entity_tags (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('diary_card', 'goal', 'habit', 'activity', 'mindmap')),
    entity_id TEXT NOT NULL,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    owner_type TEXT,
    owner_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(entity_type, entity_id, tag_id)
);
```

### マイグレーション

以下のマイグレーションファイルを順番に実行：

1. `supabase/migrations/20260114100000_add_tags_system.sql` - 初期タグシステム
2. `supabase/migrations/20260114110000_unify_tags_system.sql` - diary_tagsの統合
3. `supabase/migrations/20260114120000_unify_entity_tags.sql` - entity_tagsへの統合

```bash
# Supabaseプロジェクトでマイグレーションを実行
supabase db push
```

## TypeScript型定義

### Tag型
```typescript
export interface Tag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 更新されたGoal型、Habit型、DiaryCard型
```typescript
export interface Goal {
  // ... 既存のフィールド
  tags?: Tag[];  // 追加
}

export interface Habit {
  // ... 既存のフィールド
  tags?: Tag[];  // 追加
}

export interface DiaryCard {
  // ... 既存のフィールド
  tags?: Tag[];  // 追加
}
```

## API エンドポイント

### タグ管理（共通）

#### タグ一覧取得
```typescript
GET /tags
Response: Tag[]
```

#### タグ作成
```typescript
POST /tags
Body: { name: string, color?: string }
Response: Tag
```

#### タグ更新
```typescript
PATCH /tags/:id
Body: { name?: string, color?: string }
Response: Tag
```

#### タグ削除
```typescript
DELETE /tags/:id
Response: { success: boolean }
```

### エンティティタグ管理

#### Habitのタグ一覧取得
```typescript
GET /habits/:habitId/tags
Response: Tag[]
```

#### Habitにタグを追加
```typescript
POST /habits/:habitId/tags
Body: { tagId: string }
Response: { id: string, entityType: string, entityId: string, tagId: string }
```

#### Habitからタグを削除
```typescript
DELETE /habits/:habitId/tags/:tagId
Response: { success: boolean }
```

#### Goalのタグ一覧取得
```typescript
GET /goals/:goalId/tags
Response: Tag[]
```

#### Goalにタグを追加
```typescript
POST /goals/:goalId/tags
Body: { tagId: string }
Response: { id: string, entityType: string, entityId: string, tagId: string }
```

#### Goalからタグを削除
```typescript
DELETE /goals/:goalId/tags/:tagId
Response: { success: boolean }
```

#### Diary Cardのタグ一覧取得
```typescript
GET /diary/:diaryCardId/tags
Response: Tag[]
```

#### Diary Cardにタグを追加
```typescript
POST /diary/:diaryCardId/tags
Body: { tagId: string }
Response: { id: string, entityType: string, entityId: string, tagId: string }
```

#### Diary Cardからタグを削除
```typescript
DELETE /diary/:diaryCardId/tags/:tagId
Response: { success: boolean }
```

## 使用例

### タグの作成
```typescript
import api from '@/lib/api';

// タグを作成（すべてのエンティティで共通）
const tag = await api.createTag({
  name: '重要',
  color: '#ef4444'
});
```

### Habitにタグを追加
```typescript
// Habitにタグを追加
await api.addHabitTag(habitId, tag.id);

// Habitのタグを取得
const habitTags = await api.getHabitTags(habitId);
```

### Goalにタグを追加
```typescript
// Goalにタグを追加
await api.addGoalTag(goalId, tag.id);

// Goalのタグを取得
const goalTags = await api.getGoalTags(goalId);
```

### Diary Cardにタグを追加
```typescript
// Diary Cardにタグを追加
await api.addDiaryCardTag(diaryCardId, tag.id);

// Diary Cardのタグを取得
const diaryCardTags = await api.getDiaryCardTags(diaryCardId);
```

### タグの削除
```typescript
// Habitからタグを削除
await api.removeHabitTag(habitId, tagId);

// Goalからタグを削除
await api.removeGoalTag(goalId, tagId);

// Diary Cardからタグを削除
await api.removeDiaryCardTag(diaryCardId, tagId);

// タグ自体を削除（関連するentity_tagsも自動削除）
await api.deleteTag(tagId);
```

## ゲストユーザー対応

タグ機能はゲストユーザーにも対応しています。ゲストモードでは、以下のlocalStorageキーを使用します：

- `guest-tags`: 共通タグマスター
- `guest-entity-tags`: エンティティとタグの関連（すべてのエンティティタイプ）

## アーキテクチャの利点

### 1. 拡張性
新しいエンティティタイプ（例：`activity`、`mindmap`）を追加する場合、`entity_tags`テーブルの`entity_type`に値を追加するだけで対応できます。

### 2. 一貫性
すべてのエンティティで同じタグを共有できるため、タグ管理が統一されます。

### 3. 保守性
タグ関連のロジックが`getEntityTags`、`addEntityTag`、`removeEntityTag`の3つのプライベートメソッドに集約されています。

## 今後の拡張

このタグシステムを基盤として、以下の機能を実装できます：

1. **タグフィルタリング**: 特定のタグが付いたエンティティのみを表示
2. **タグ統計**: タグごとの完了率や進捗状況の可視化
3. **タグベースの検索**: タグで素早くエンティティを検索
4. **タグの色分け**: UIでタグを色で識別
5. **タグの自動提案**: よく使うタグの提案機能
6. **クロスエンティティ検索**: 同じタグを持つHabit、Goal、Diary Cardを横断検索

## 注意事項

- タグ名は同じowner内でユニークである必要があります
- タグを削除すると、関連するentity_tagsも自動的に削除されます（CASCADE）
- エンティティを削除しても、タグ自体は削除されません（他のエンティティで使用されている可能性があるため）
- `entity_type`は`CHECK`制約で制限されているため、新しいタイプを追加する場合はマイグレーションが必要です
