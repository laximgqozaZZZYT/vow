# ISS-20260204-017: Suggestion Button Enhancement - Design

## Overview
- **Purpose**: 提案ボタン機能拡張の技術設計
- **Status**: In Progress
- **Version**: 1.0.0
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

## Architecture

### Component Hierarchy

```
Section.MOC.tsx
├── ChatTab
│   ├── MessageList
│   │   ├── ChatMessage
│   │   │   ├── SuggestionCard (既存)
│   │   │   │   ├── SkeletonLoader (新規)
│   │   │   │   ├── ActionButtons (拡張)
│   │   │   │   │   ├── AcceptButton
│   │   │   │   │   ├── SnoozeButton (新規)
│   │   │   │   │   └── DismissButton
│   │   │   │   └── SelectCheckbox (新規)
│   │   │   └── SuggestionCardList (新規)
│   │   │       └── BulkActionBar (新規)
│   │   └── FilterDropdown (新規)
├── HistoryTab
│   ├── HistoryFilter (新規)
│   ├── SnoozedSection (新規)
│   └── HistoryList (拡張)
```

### State Management

```typescript
// 新規: 提案履歴の状態
interface SuggestionHistory {
  id: string;
  suggestionId: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  status: 'accepted' | 'snoozed' | 'dismissed';
  createdAt: Date;
  statusChangedAt: Date;
  snoozeUntil?: Date;
  messageId?: string;
}

// 拡張: 提案の状態管理
interface SuggestionStateManager {
  // 既存
  suggestions: Map<string, SuggestionState>;

  // 新規
  history: SuggestionHistory[];
  selectedIds: Set<string>;
  filter: SuggestionFilter;
  isLoading: boolean;
  loadingCount: number;
}

// 新規: フィルタ設定
interface SuggestionFilter {
  type: 'all' | 'habit' | 'goal';
  status: 'all' | 'pending' | 'accepted' | 'snoozed' | 'dismissed';
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}
```

## Technical Design

### 1. SkeletonLoader Component

```typescript
// 新規コンポーネント: SuggestionSkeleton.tsx

interface SuggestionSkeletonProps {
  count?: number;
}

const SuggestionSkeleton: React.FC<SuggestionSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2" />
          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-3" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20" />
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-20" />
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 2. Enhanced SuggestionCard

```typescript
// 拡張: SuggestionCard のアクションボタン

interface SuggestionCardProps {
  suggestion: Suggestion;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onAccept: () => void;
  onSnooze: () => void;  // 新規
  onDismiss: () => void;
  status: SuggestionStatus;
}

// アクションボタンの配置
// [チェックボックス] [提案内容] [受諾] [後で] [却下]
```

### 3. Snooze Management Hook

```typescript
// 新規フック: useSnoozedSuggestions.ts

interface UseSnoozedSuggestionsResult {
  snoozedSuggestions: SnoozedSuggestion[];
  snooze: (suggestion: Suggestion, durationHours?: number) => void;
  unsnooze: (id: string) => void;
  checkExpired: () => SnoozedSuggestion[];
  clearExpired: () => void;
}

const SNOOZE_STORAGE_KEY = 'vow_snoozed_suggestions';
const DEFAULT_SNOOZE_HOURS = 24;

export function useSnoozedSuggestions(): UseSnoozedSuggestionsResult {
  const [snoozed, setSnoozed] = useState<SnoozedSuggestion[]>(() => {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozed));
  }, [snoozed]);

  const snooze = useCallback((suggestion: Suggestion, durationHours = DEFAULT_SNOOZE_HOURS) => {
    const snoozeUntil = new Date();
    snoozeUntil.setHours(snoozeUntil.getHours() + durationHours);

    setSnoozed(prev => [...prev, {
      id: `snooze-${Date.now()}`,
      suggestionId: suggestion.id,
      type: suggestion.type,
      data: suggestion.data,
      snoozedAt: new Date(),
      snoozeUntil,
    }]);
  }, []);

  const checkExpired = useCallback(() => {
    const now = new Date();
    return snoozed.filter(s => new Date(s.snoozeUntil) <= now);
  }, [snoozed]);

  return { snoozedSuggestions: snoozed, snooze, unsnooze, checkExpired, clearExpired };
}
```

### 4. History Management Hook

```typescript
// 新規フック: useSuggestionHistory.ts

interface UseSuggestionHistoryResult {
  history: SuggestionHistory[];
  addToHistory: (suggestion: Suggestion, status: 'accepted' | 'dismissed') => void;
  filter: (filter: SuggestionFilter) => SuggestionHistory[];
  clear: () => void;
}

const HISTORY_STORAGE_KEY = 'vow_suggestion_history';
const MAX_HISTORY_ITEMS = 100;

export function useSuggestionHistory(): UseSuggestionHistoryResult {
  const [history, setHistory] = useState<SuggestionHistory[]>(() => {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = useCallback((suggestion: Suggestion, status: 'accepted' | 'dismissed') => {
    setHistory(prev => {
      const newHistory = [{
        id: `history-${Date.now()}`,
        suggestionId: suggestion.id,
        type: suggestion.type,
        data: suggestion.data,
        status,
        createdAt: new Date(suggestion.createdAt || Date.now()),
        statusChangedAt: new Date(),
      }, ...prev];

      // 最大件数を超えたら古いものを削除
      return newHistory.slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  const filterHistory = useCallback((filter: SuggestionFilter) => {
    return history.filter(h => {
      if (filter.type !== 'all' && h.type !== filter.type) return false;
      if (filter.status !== 'all' && h.status !== filter.status) return false;
      return true;
    });
  }, [history]);

  return { history, addToHistory, filter: filterHistory, clear };
}
```

### 5. Bulk Selection Hook

```typescript
// 新規フック: useBulkSelection.ts

interface UseBulkSelectionResult<T> {
  selectedIds: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  selectedItems: T[];
}

export function useBulkSelection<T extends { id: string }>(
  items: T[]
): UseBulkSelectionResult<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedItems = useMemo(() =>
    items.filter(item => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  return {
    selectedIds,
    isSelected: (id) => selectedIds.has(id),
    toggle,
    selectAll,
    clearSelection,
    selectedItems,
  };
}
```

### 6. Filter Component

```typescript
// 新規コンポーネント: SuggestionFilter.tsx

interface SuggestionFilterProps {
  filter: SuggestionFilter;
  onChange: (filter: SuggestionFilter) => void;
  categories?: string[];
}

const SuggestionFilterComponent: React.FC<SuggestionFilterProps> = ({
  filter,
  onChange,
  categories = ['健康', '学習', '仕事', '趣味', 'その他']
}) => {
  return (
    <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <select
        value={filter.type}
        onChange={(e) => onChange({ ...filter, type: e.target.value as SuggestionFilter['type'] })}
        className="px-3 py-1 rounded border text-sm"
      >
        <option value="all">すべて</option>
        <option value="habit">習慣</option>
        <option value="goal">目標</option>
      </select>

      <select
        value={filter.category || ''}
        onChange={(e) => onChange({ ...filter, category: e.target.value || undefined })}
        className="px-3 py-1 rounded border text-sm"
      >
        <option value="">カテゴリ: すべて</option>
        {categories.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select
        value={filter.difficulty || ''}
        onChange={(e) => onChange({ ...filter, difficulty: e.target.value as SuggestionFilter['difficulty'] || undefined })}
        className="px-3 py-1 rounded border text-sm"
      >
        <option value="">難易度: すべて</option>
        <option value="beginner">初級</option>
        <option value="intermediate">中級</option>
        <option value="advanced">上級</option>
      </select>
    </div>
  );
};
```

## Integration Points

### Section.MOC.tsx への統合

```typescript
// Section.MOC.tsx の変更箇所

// 1. 新規インポート
import { useSnoozedSuggestions } from '../hooks/useSnoozedSuggestions';
import { useSuggestionHistory } from '../hooks/useSuggestionHistory';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { SuggestionSkeleton } from './SuggestionSkeleton';
import { SuggestionFilter as FilterComponent } from './SuggestionFilter';

// 2. フック初期化（MOCSection内）
const { snoozedSuggestions, snooze, checkExpired } = useSnoozedSuggestions();
const { history, addToHistory, filter: filterHistory } = useSuggestionHistory();
const { selectedIds, toggle, selectAll, clearSelection, selectedItems } = useBulkSelection(suggestions);

// 3. ローディング状態の管理
const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

// 4. parseSuggestions呼び出し前にローディング状態をセット
useEffect(() => {
  if (msg.status === 'streaming') {
    setIsGeneratingSuggestions(true);
  } else if (msg.status === 'complete') {
    setIsGeneratingSuggestions(false);
  }
}, [msg.status]);

// 5. SuggestionCard のレンダリング更新
{isGeneratingSuggestions ? (
  <SuggestionSkeleton count={3} />
) : (
  suggestions?.map(suggestion => (
    <SuggestionCard
      key={suggestion.id}
      suggestion={suggestion}
      isSelected={selectedIds.has(suggestion.id)}
      onSelect={toggle}
      onAccept={() => handleAccept(suggestion)}
      onSnooze={() => snooze(suggestion)}
      onDismiss={() => handleDismiss(suggestion)}
    />
  ))
)}
```

## File Changes Summary

### New Files
| File Path | Description |
|-----------|-------------|
| `frontend/app/dashboard/hooks/useSnoozedSuggestions.ts` | スヌーズ管理フック |
| `frontend/app/dashboard/hooks/useSuggestionHistory.ts` | 履歴管理フック |
| `frontend/app/dashboard/hooks/useBulkSelection.ts` | 一括選択フック |
| `frontend/app/dashboard/components/SuggestionSkeleton.tsx` | スケルトンローダー |
| `frontend/app/dashboard/components/SuggestionFilter.tsx` | フィルタコンポーネント |
| `frontend/app/dashboard/components/BulkActionBar.tsx` | 一括操作バー |

### Modified Files
| File Path | Changes |
|-----------|---------|
| `frontend/app/dashboard/components/Section.MOC.tsx` | フック統合、UI更新 |

## Testing Strategy

### Unit Tests
- useSnoozedSuggestions: snooze/unsnooze/checkExpired
- useSuggestionHistory: addToHistory/filter
- useBulkSelection: toggle/selectAll/clearSelection

### Integration Tests
- SuggestionCard with new actions
- History tab with filtered list
- Bulk operations flow

### E2E Tests
- 提案生成→スヌーズ→履歴確認フロー
- 一括選択→一括受諾フロー
- フィルタ適用→結果確認フロー

## Dependencies

- React 19
- Tailwind CSS 4
- localStorage API
- 既存の型定義（Suggestion, SuggestionState等）

## Migration Notes

- localStorage に新しいキーを追加
- 既存の suggestionStates との互換性を維持
- 段階的なロールアウト可能
