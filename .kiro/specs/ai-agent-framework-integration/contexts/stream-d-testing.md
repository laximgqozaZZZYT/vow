# Stream D: Testing Agent - Initial Context

## Agent Role
Testing専門エージェント。ユニットテスト、統合テスト、プロパティベーステスト、ドキュメント作成を担当。

## Project Context

### Working Directory
`/home/ubuntu/Downloads/vow` (プロジェクトルート)

### Key Existing Test Files to Understand

1. **Frontend Tests** (`frontend/__tests__/`)
   - Jest + React Testing Library
   - `jest.config.js` で設定
   - `npm test` で実行

2. **Backend Tests** (`backend/__tests__/`)
   - Jest
   - `jest.config.js` で設定
   - `npm test` で実行

3. **Property-Based Tests** (既存パターン)
   - fast-check ライブラリ使用
   - `*.property.test.ts` 命名規則

### Technology Stack
- Jest (テストフレームワーク)
- React Testing Library (Reactコンポーネント)
- fast-check (プロパティベーステスト)
- Vitest (統合テスト、将来的)

---

## Initial Tasks for Stream D

### D-001: テストインフラストラクチャ構築
**Priority**: High
**Dependencies**: B-003 (ツールライブラリ完成後)

**Steps**:

1. **Agent Tools用テストユーティリティ作成**

`frontend/lib/agent-tools/__tests__/test-utils.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * Mock Supabase client for testing
 */
export function createMockSupabase() {
  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null,
      }),
    },
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
}

/**
 * Mock tool context for testing
 */
export function createMockToolContext(overrides = {}) {
  return {
    userId: 'test-user-id',
    supabase: createMockSupabase(),
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    ...overrides,
  };
}

/**
 * Mock agent response for testing
 */
export function createMockAgentResponse(content: string, toolCalls: any[] = []) {
  return {
    content,
    toolCalls,
    usage: { promptTokens: 100, completionTokens: 50 },
    finishReason: 'stop',
  };
}
```

2. **Jest設定の拡張**

`frontend/jest.config.js` に追加:
```javascript
module.exports = {
  // ... existing config
  moduleNameMapper: {
    '^@/lib/agent-tools/(.*)$': '<rootDir>/lib/agent-tools/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    '**/__tests__/**/*.property.test.ts',
  ],
};
```

**Output Files**:
- `frontend/lib/agent-tools/__tests__/test-utils.ts`
- Jest設定更新

---

### D-002: habit-tools ユニットテスト作成
**Priority**: High
**Dependencies**: B-003, D-001

**`frontend/lib/agent-tools/__tests__/habit-tools.test.ts`**:
```typescript
import { habitTools, CreateHabitSchema } from '../habit-tools';
import { createMockToolContext, createMockSupabase } from './test-utils';

describe('habitTools', () => {
  describe('createHabit', () => {
    it('should create a habit with valid input', async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.from().insert.mockResolvedValue({
        data: { id: 'new-habit-id', name: 'Test Habit' },
        error: null,
      });

      const context = createMockToolContext({ supabase: mockSupabase });
      const input = {
        name: 'Test Habit',
        type: 'do' as const,
        frequency: 'daily' as const,
      };

      const result = await habitTools.createHabit.execute(input, context);

      expect(mockSupabase.from).toHaveBeenCalledWith('habits');
      expect(result).toHaveProperty('id');
    });

    it('should reject invalid input', async () => {
      const context = createMockToolContext();
      const invalidInput = { name: '' }; // Missing required fields

      await expect(
        habitTools.createHabit.execute(invalidInput as any, context)
      ).rejects.toThrow();
    });
  });

  describe('getHabits', () => {
    it('should return active habits by default', async () => {
      const mockSupabase = createMockSupabase();
      mockSupabase.from().select.mockResolvedValue({
        data: [{ id: '1', name: 'Habit 1', active: true }],
        error: null,
      });

      const context = createMockToolContext({ supabase: mockSupabase });
      const result = await habitTools.getHabits.execute({ activeOnly: true }, context);

      expect(result).toHaveLength(1);
    });
  });

  describe('analyzeHabits', () => {
    it('should return analysis for the specified period', async () => {
      const context = createMockToolContext();
      const result = await habitTools.analyzeHabits.execute({ period: 'month' }, context);

      expect(result).toHaveProperty('completionRate');
      expect(result).toHaveProperty('insights');
    });
  });
});

describe('CreateHabitSchema', () => {
  it('should accept valid input', () => {
    const validInput = {
      name: 'Morning Run',
      type: 'do',
      frequency: 'daily',
    };

    const result = CreateHabitSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const invalidInput = {
      name: '',
      type: 'do',
      frequency: 'daily',
    };

    const result = CreateHabitSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject invalid type', () => {
    const invalidInput = {
      name: 'Test',
      type: 'invalid',
      frequency: 'daily',
    };

    const result = CreateHabitSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
});
```

**Property-Based Tests** (`habit-tools.property.test.ts`):
```typescript
import * as fc from 'fast-check';
import { CreateHabitSchema } from '../habit-tools';

describe('CreateHabitSchema property tests', () => {
  it('should always accept valid habit names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (name) => {
          const input = {
            name,
            type: 'do',
            frequency: 'daily',
          };
          const result = CreateHabitSchema.safeParse(input);
          return result.success;
        }
      )
    );
  });

  it('should reject names longer than 100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101 }),
        (name) => {
          const input = {
            name,
            type: 'do',
            frequency: 'daily',
          };
          const result = CreateHabitSchema.safeParse(input);
          return !result.success;
        }
      )
    );
  });

  it('should handle targetCount as positive integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (targetCount) => {
          const input = {
            name: 'Test',
            type: 'do',
            frequency: 'daily',
            targetCount,
          };
          const result = CreateHabitSchema.safeParse(input);
          return result.success && result.data.targetCount === targetCount;
        }
      )
    );
  });
});
```

**Output Files**:
- `frontend/lib/agent-tools/__tests__/habit-tools.test.ts`
- `frontend/lib/agent-tools/__tests__/habit-tools.property.test.ts`

---

### D-003: Error Handler テスト作成
**Priority**: Medium
**Dependencies**: B-004, D-001

**`frontend/lib/agent-tools/__tests__/error-handler.test.ts`**:
```typescript
import { withRetry, CircuitBreaker } from '../error-handler';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should succeed on first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const promise = withRetry(fn);

    // Fast-forward through retry delay
    jest.advanceTimersByTime(2000);

    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fail'));

    const promise = withRetry(fn, { maxRetries: 3 });

    // Fast-forward through all retry delays
    jest.advanceTimersByTime(2000 + 4000 + 8000);

    await expect(promise).rejects.toThrow('always fail');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success');

    const delays: number[] = [];
    const originalSetTimeout = setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation((callback, ms) => {
      delays.push(ms as number);
      return originalSetTimeout(callback, 0);
    });

    await withRetry(fn, { baseDelayMs: 1000 });

    expect(delays[0]).toBe(1000); // First retry: 1s
    expect(delays[1]).toBe(2000); // Second retry: 2s
  });
});

describe('CircuitBreaker', () => {
  it('should allow requests when closed', async () => {
    const cb = new CircuitBreaker(3, 1000);
    const fn = jest.fn().mockResolvedValue('success');

    const result = await cb.execute(fn);

    expect(result).toBe('success');
  });

  it('should open after threshold failures', async () => {
    const cb = new CircuitBreaker(3, 1000);
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    // Cause 3 failures
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }

    // 4th call should be blocked by circuit breaker
    await expect(cb.execute(fn)).rejects.toThrow('Circuit breaker is open');
    expect(fn).toHaveBeenCalledTimes(3); // Not 4
  });

  it('should reset after timeout', async () => {
    jest.useFakeTimers();
    const cb = new CircuitBreaker(1, 1000);

    const failingFn = jest.fn().mockRejectedValue(new Error('fail'));
    const succeedingFn = jest.fn().mockResolvedValue('success');

    await expect(cb.execute(failingFn)).rejects.toThrow();

    // Fast-forward past reset time
    jest.advanceTimersByTime(1500);

    const result = await cb.execute(succeedingFn);
    expect(result).toBe('success');

    jest.useRealTimers();
  });
});
```

**Output Files**:
- `frontend/lib/agent-tools/__tests__/error-handler.test.ts`

---

## Coding Guidelines for Stream D

1. **テスト命名**: `should + 期待される動作` 形式
2. **モック**: 外部依存はすべてモック化
3. **カバレッジ**: 最低80%を目標
4. **プロパティテスト**: 境界値、ランダム入力をテスト

---

## Test Execution Commands

```bash
# Frontend tests
cd /home/ubuntu/Downloads/vow/frontend
npm test

# Specific file
npm test -- habit-tools.test.ts

# With coverage
npm test -- --coverage

# Property tests only
npm test -- --testPathPattern=property
```

---

## Integration Points

### With Stream B
- ツールライブラリのテスト
- エラーハンドラーのテスト

### With Stream A
- Reactコンポーネントのテスト (Phase 2)

### With Stream C
- Embedding Serviceのテスト
- RAG統合テスト

---

## Branch Naming
```
feat/ai-agent-framework-stream-d-{task-id}
```
Example: `feat/ai-agent-framework-stream-d-001`

---

## Success Criteria

- [ ] テストユーティリティがモックを正しく提供する
- [ ] habit-tools のユニットテストが全てパス
- [ ] プロパティベーステストが境界値を検証
- [ ] error-handler のリトライロジックがテストされている
- [ ] CircuitBreakerの状態遷移がテストされている
- [ ] カバレッジ80%以上
