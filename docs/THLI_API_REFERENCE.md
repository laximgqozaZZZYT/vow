# THLI-24 API リファレンス

このドキュメントは、習慣・目標レベルシステム（THLI-24）のAPIエンドポイントを説明します。

## 概要

THLI-24 APIは、習慣の難易度レベル評価、レベル履歴管理、ベビーステップ生成、クォータ管理を提供します。

### ベースURL

| 環境 | ベースURL |
|------|-----------|
| 開発 | `https://lyry9riumg.execute-api.ap-northeast-1.amazonaws.com/development` |
| 本番 | `https://cy20h2nht8.execute-api.ap-northeast-1.amazonaws.com/production` |

### 認証

すべてのエンドポイントは認証が必要です。リクエストヘッダーに以下を含めてください：

```
Authorization: Bearer <access_token>
```

---

## エンドポイント一覧

| メソッド | エンドポイント | 説明 |
|---------|---------------|------|
| POST | `/api/habits/:id/assess-level` | THLI-24レベル評価を開始 |
| GET | `/api/habits/:id/level-history` | レベル変更履歴を取得 |
| POST | `/api/habits/:id/accept-baby-step` | ベビーステッププランを承認 |
| POST | `/api/habits/:id/accept-level-up` | レベルアップ提案を承認 |
| GET | `/api/users/:id/thli-quota` | THLI-24クォータ状況を取得 |
| GET | `/api/habits/:id/level-details` | レベル詳細情報を取得 |

---

## 1. POST /api/habits/:id/assess-level

THLI-24フレームワークを使用して習慣のレベル評価を開始します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | 習慣ID |

### リクエストボディ

```json
{
  "conversation_context": {
    "previous_messages": []
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| conversation_context | object | - | 既存の会話コンテキスト（再開時に使用） |

### レスポンス

#### 成功時 (200 OK)

```json
{
  "assessment_id": "assess_abc123def456",
  "status": "in_progress",
  "conversation_id": "conv_xyz789",
  "first_question": "「30分ジョギング」という習慣について評価を開始します。まず、この習慣を具体的にどのように行っていますか？（例：どこで、どのように走るか）",
  "quota_status": {
    "quota_used": 3,
    "quota_limit": 10,
    "remaining": 7
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| assessment_id | string | 評価セッションID |
| status | string | ステータス: `in_progress`, `completed`, `needs_more_data` |
| conversation_id | string | AIコーチ会話ID |
| first_question | string | 最初の監査質問 |
| quota_status | object | クォータ状況 |

#### エラー時

**クォータ超過 (402 Payment Required)**
```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "今月の評価回数を使い切りました。プレミアムプランにアップグレードすると無制限で評価できます。",
    "upgrade_required": true,
    "retryable": false
  }
}
```

**習慣が見つからない (404 Not Found)**
```json
{
  "error": {
    "code": "HABIT_NOT_FOUND",
    "message": "指定された習慣が見つかりません。",
    "retryable": false
  }
}
```

**認証エラー (401 Unauthorized)**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "認証が必要です。",
    "retryable": false
  }
}
```

---

## 2. GET /api/habits/:id/level-history

習慣のレベル変更履歴を取得します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | 習慣ID |

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| start_date | string | - | 開始日（ISO 8601形式） |
| end_date | string | - | 終了日（ISO 8601形式） |
| change_type | string | - | 変更タイプ: `all`, `level_up`, `level_down`, `re_assessment` |
| limit | number | - | 取得件数（デフォルト: 50） |
| offset | number | - | オフセット（デフォルト: 0） |

### レスポンス

#### 成功時 (200 OK)

```json
{
  "history": [
    {
      "id": "lh_abc123",
      "entity_type": "habit",
      "entity_id": "habit_xyz789",
      "old_level": 65,
      "new_level": 75,
      "reason": "level_up_progression",
      "reason_label": "レベルアップ",
      "workload_delta": {
        "workload_per_count": {
          "old": 30,
          "new": 36,
          "change_percent": 20
        },
        "frequency": {
          "old": "daily",
          "new": "daily"
        }
      },
      "assessed_at": "2025-01-27T10:30:00Z",
      "created_at": "2025-01-27T10:30:00Z"
    },
    {
      "id": "lh_def456",
      "entity_type": "habit",
      "entity_id": "habit_xyz789",
      "old_level": null,
      "new_level": 65,
      "reason": "initial_assessment",
      "reason_label": "初回評価",
      "workload_delta": null,
      "assessed_at": "2024-12-27T09:00:00Z",
      "created_at": "2024-12-27T09:00:00Z"
    }
  ],
  "total": 2,
  "has_more": false
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| history | array | レベル変更履歴の配列 |
| total | number | 総件数 |
| has_more | boolean | 追加データの有無 |

#### 履歴エントリのフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | string | 履歴エントリID |
| entity_type | string | エンティティタイプ: `habit` または `goal` |
| entity_id | string | 習慣/目標ID |
| old_level | number \| null | 変更前のレベル（初回評価時はnull） |
| new_level | number | 変更後のレベル |
| reason | string | 変更理由コード |
| reason_label | string | 変更理由の表示ラベル |
| workload_delta | object \| null | ワークロード変更詳細 |
| assessed_at | string | 評価日時（ISO 8601） |
| created_at | string | 作成日時（ISO 8601） |

#### 変更理由コード

| コード | ラベル | 説明 |
|--------|--------|------|
| `initial_assessment` | 初回評価 | 初めてのレベル評価 |
| `re_assessment` | 再評価 | 手動での再評価 |
| `level_up_progression` | レベルアップ | 進捗によるレベルアップ |
| `level_down_baby_step_lv50` | ベビーステップ (Lv.50) | Lv.50プランの適用 |
| `level_down_baby_step_lv10` | ベビーステップ (Lv.10) | Lv.10プランの適用 |

---

## 3. POST /api/habits/:id/accept-baby-step

ベビーステッププランを承認し、習慣を簡略化します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | 習慣ID |

### リクエストボディ

```json
{
  "plan_type": "lv50",
  "proposed_changes": {
    "name": "15分ジョギング",
    "frequency": "3x_weekly",
    "workload_per_count": 15,
    "duration": 15
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| plan_type | string | ✓ | プランタイプ: `lv50` または `lv10` |
| proposed_changes | object | ✓ | 提案された変更内容 |

#### proposed_changes のフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| name | string | 新しい習慣名 |
| frequency | string | 新しい頻度 |
| workload_per_count | number | 新しいワークロード |
| duration | number | 新しい所要時間（分） |

### レスポンス

#### 成功時 (200 OK)

```json
{
  "habit": {
    "id": "habit_xyz789",
    "name": "15分ジョギング",
    "type": "do",
    "frequency": "3x_weekly",
    "workload_per_count": 15,
    "duration": 15,
    "level": 35,
    "level_tier": "beginner",
    "level_last_assessed_at": "2025-01-27T10:30:00Z"
  },
  "level_change": {
    "old_level": 70,
    "new_level": 35,
    "reason": "level_down_baby_step_lv50"
  }
}
```

---

## 4. POST /api/habits/:id/accept-level-up

レベルアップ提案を承認し、習慣のワークロードを増加させます。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | 習慣ID |

### リクエストボディ

```json
{
  "target_level": 85,
  "workload_changes": {
    "workload_per_count": {
      "old": 30,
      "new": 36,
      "change_percent": 20
    },
    "frequency": {
      "old": "daily",
      "new": "daily"
    }
  }
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| target_level | number | ✓ | 目標レベル（0-199） |
| workload_changes | object | ✓ | ワークロード変更内容 |

### レスポンス

#### 成功時 (200 OK)

```json
{
  "habit": {
    "id": "habit_xyz789",
    "name": "30分ジョギング",
    "type": "do",
    "frequency": "daily",
    "workload_per_count": 36,
    "level": 85,
    "level_tier": "intermediate",
    "level_last_assessed_at": "2025-01-27T10:30:00Z"
  },
  "level_change": {
    "old_level": 70,
    "new_level": 85,
    "reason": "level_up_progression"
  }
}
```

---

## 5. GET /api/users/:id/thli-quota

ユーザーのTHLI-24評価クォータ状況を取得します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | ユーザーID |

### レスポンス

#### 成功時 (200 OK)

**フリーユーザーの場合:**
```json
{
  "quota_used": 3,
  "quota_limit": 10,
  "remaining": 7,
  "period_start": "2025-01-01T00:00:00Z",
  "period_end": "2025-01-31T23:59:59Z",
  "is_unlimited": false,
  "plan": "free"
}
```

**プレミアムユーザーの場合:**
```json
{
  "quota_used": 25,
  "quota_limit": -1,
  "remaining": -1,
  "period_start": "2025-01-01T00:00:00Z",
  "period_end": "2025-01-31T23:59:59Z",
  "is_unlimited": true,
  "plan": "premium"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| quota_used | number | 今月の使用回数 |
| quota_limit | number | 月間上限（-1は無制限） |
| remaining | number | 残り回数（-1は無制限） |
| period_start | string | 期間開始日（ISO 8601） |
| period_end | string | 期間終了日（ISO 8601） |
| is_unlimited | boolean | 無制限フラグ |
| plan | string | プラン名: `free` または `premium` |

---

## 6. GET /api/habits/:id/level-details

習慣の完全なTHLI-24評価データを取得します。

### パスパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| id | string | ✓ | 習慣ID |

### レスポンス

#### 成功時 (200 OK)

```json
{
  "level": 75,
  "level_tier": "intermediate",
  "last_assessed_at": "2025-01-27T10:30:00Z",
  "assessment_data": {
    "facts": {
      "F01": {
        "value": "30分ジョギング",
        "u_type": "U0",
        "e_type": "E2",
        "source": "user_stated"
      },
      "F02": {
        "value": "3km走り終える",
        "u_type": "U0",
        "e_type": "E2",
        "source": "user_stated"
      }
    },
    "variables": [
      {
        "id": "①",
        "name": "Cognitive Load",
        "domain": "cognitive",
        "score": 2.8,
        "stoplight": "yellow",
        "rationale": "Moderate planning required for route and pace",
        "causing_facts": ["F01", "F15"]
      },
      {
        "id": "②",
        "name": "Physical Demand",
        "domain": "physical",
        "score": 4.1,
        "stoplight": "yellow",
        "rationale": "Moderate cardiovascular effort required",
        "causing_facts": ["F01", "F03"]
      }
    ],
    "ici": 0.85,
    "ab_used": 2,
    "firewall_triggered": false,
    "o_level": 65,
    "e_level_range": {
      "min": 70,
      "max": 80
    },
    "c_level": 85,
    "prompt_version": "v1.9"
  },
  "cross_framework_scores": {
    "tlx_score": 72,
    "srbai_score": 45,
    "comb_score": 68,
    "gate_status": "pass"
  }
}
```

#### 未評価の場合 (200 OK)

```json
{
  "level": null,
  "level_tier": null,
  "last_assessed_at": null,
  "assessment_data": null,
  "cross_framework_scores": null,
  "message": "この習慣はまだ評価されていません。"
}
```

### assessment_data のフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| facts | object | F01-F16の習慣ファクト |
| variables | array | 24個のTHLI-24変数 |
| ici | number | Information Completeness Index (0.0-1.0) |
| ab_used | number | 使用したAssumption Budget |
| firewall_triggered | boolean | Missingness Firewallが発動したか |
| o_level | number | Optimistic レベル推定 |
| e_level_range | object | Expected レベル範囲 |
| c_level | number | Conservative レベル推定 |
| prompt_version | string | 使用したプロンプトバージョン |

### cross_framework_scores のフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| tlx_score | number | NASA-TLXスコア (0-199) |
| srbai_score | number | SRBAIスコア (0-199) |
| comb_score | number | COM-Bスコア (0-199) |
| gate_status | string | ゲートステータス: `pass` または `fail` |

---

## エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|---------------|------|
| `UNAUTHORIZED` | 401 | 認証が必要 |
| `FORBIDDEN` | 403 | アクセス権限がない |
| `HABIT_NOT_FOUND` | 404 | 習慣が見つからない |
| `USER_NOT_FOUND` | 404 | ユーザーが見つからない |
| `QUOTA_EXCEEDED` | 402 | クォータ超過 |
| `ASSESSMENT_IN_PROGRESS` | 409 | 評価が進行中 |
| `INVALID_PLAN_TYPE` | 400 | 無効なプランタイプ |
| `INVALID_LEVEL` | 400 | 無効なレベル値 |
| `SERVICE_UNAVAILABLE` | 503 | サービス一時停止 |
| `OPENAI_ERROR` | 502 | OpenAI API エラー |

---

## レート制限

| エンドポイント | 制限 |
|---------------|------|
| POST /api/habits/:id/assess-level | 1リクエスト/2秒 |
| その他のエンドポイント | 100リクエスト/分 |

---

## 関連ドキュメント

- [THLI-24 ユーザーガイド](./THLI_USER_GUIDE.md)
- [THLI-24 マニュアルテストガイド](./THLI_MANUAL_TESTING_GUIDE.md)
- [デプロイ手順](./DEPLOYMENT_GUIDE.md)
