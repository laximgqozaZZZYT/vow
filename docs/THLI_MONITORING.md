# THLI-24 モニタリングダッシュボード

このドキュメントでは、THLI-24習慣レベルシステムのモニタリング設定について説明します。

---

## 目次

1. [概要](#概要)
2. [主要メトリクス](#主要メトリクス)
3. [CloudWatchダッシュボード設定](#cloudwatchダッシュボード設定)
4. [アラート設定](#アラート設定)
5. [ログ分析](#ログ分析)

---

## 概要

THLI-24システムの健全性を監視するために、以下の観点でモニタリングを行います：

- **評価フロー**: 評価の開始から完了までの成功率
- **品質指標**: Firewall発動率、クロスフレームワーク検証結果
- **パフォーマンス**: API応答時間、処理時間
- **コスト管理**: OpenAI API使用量、クォータ消費状況

---

## 主要メトリクス

### 1. THLI評価ファネル

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `thli.assessment.initiated` | 評価開始数 | - |
| `thli.assessment.completed` | 評価完了数 | - |
| `thli.assessment.completion_rate` | 完了率 | > 80% |
| `thli.assessment.avg_duration_seconds` | 平均評価時間 | < 180秒 |

### 2. Missingness Firewall

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `thli.firewall.triggered` | Firewall発動数 | - |
| `thli.firewall.trigger_rate` | Firewall発動率 | < 50% |
| `thli.firewall.avg_ici` | 平均ICI値 | > 0.7 |
| `thli.firewall.voi_questions_generated` | VOI質問生成数 | - |

### 3. クロスフレームワーク検証

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `thli.crossframework.gate_pass` | ゲート通過数 | - |
| `thli.crossframework.gate_fail` | ゲート失敗数 | - |
| `thli.crossframework.failure_rate` | ゲート失敗率 | < 30% |
| `thli.crossframework.avg_deviation` | 平均偏差 | < 15ポイント |

### 4. レベル分布

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `thli.level.beginner_count` | Beginner習慣数 | - |
| `thli.level.intermediate_count` | Intermediate習慣数 | - |
| `thli.level.advanced_count` | Advanced習慣数 | - |
| `thli.level.expert_count` | Expert習慣数 | - |
| `thli.level.avg_level` | 平均レベル | - |

### 5. OpenAI API

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `openai.api.requests` | リクエスト数 | - |
| `openai.api.errors` | エラー数 | - |
| `openai.api.error_rate` | エラー率 | < 10% |
| `openai.api.avg_latency_ms` | 平均レイテンシ | < 3000ms |
| `openai.api.tokens_used` | トークン使用量 | - |

### 6. クォータ使用状況

| メトリクス | 説明 | 目標値 |
|-----------|------|--------|
| `thli.quota.total_used` | 総使用回数 | - |
| `thli.quota.exhausted_users` | クォータ枯渇ユーザー数 | - |
| `thli.quota.upgrade_prompts` | アップグレード促進表示数 | - |

---

## CloudWatchダッシュボード設定

### ダッシュボードJSON

以下のJSONをAWS CloudWatchにインポートしてダッシュボードを作成します。

```json
{
  "widgets": [
    {
      "type": "text",
      "x": 0,
      "y": 0,
      "width": 24,
      "height": 1,
      "properties": {
        "markdown": "# THLI-24 習慣レベルシステム モニタリング"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 1,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "THLI評価ファネル",
        "view": "timeSeries",
        "stacked": false,
        "metrics": [
          ["VOW/THLI", "assessment.initiated", { "label": "開始", "color": "#2ca02c" }],
          ["VOW/THLI", "assessment.completed", { "label": "完了", "color": "#1f77b4" }],
          ["VOW/THLI", "assessment.failed", { "label": "失敗", "color": "#d62728" }]
        ],
        "region": "ap-northeast-1",
        "period": 3600,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 8,
      "y": 1,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "評価完了率",
        "view": "gauge",
        "metrics": [
          ["VOW/THLI", "assessment.completion_rate", { "label": "完了率" }]
        ],
        "region": "ap-northeast-1",
        "period": 86400,
        "stat": "Average",
        "yAxis": {
          "left": { "min": 0, "max": 100 }
        },
        "annotations": {
          "horizontal": [
            { "value": 80, "label": "目標", "color": "#2ca02c" },
            { "value": 50, "label": "警告", "color": "#ff7f0e" }
          ]
        }
      }
    },
    {
      "type": "metric",
      "x": 16,
      "y": 1,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "平均評価時間",
        "view": "singleValue",
        "metrics": [
          ["VOW/THLI", "assessment.duration_seconds", { "label": "秒" }]
        ],
        "region": "ap-northeast-1",
        "period": 86400,
        "stat": "Average"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 7,
      "width": 12,
      "height": 6,
      "properties": {
        "title": "Firewall発動率",
        "view": "timeSeries",
        "stacked": false,
        "metrics": [
          ["VOW/THLI", "firewall.trigger_rate", { "label": "発動率 (%)", "color": "#ff7f0e" }]
        ],
        "region": "ap-northeast-1",
        "period": 3600,
        "stat": "Average",
        "annotations": {
          "horizontal": [
            { "value": 50, "label": "アラート閾値", "color": "#d62728" }
          ]
        }
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 7,
      "width": 12,
      "height": 6,
      "properties": {
        "title": "クロスフレームワーク ゲート失敗率",
        "view": "timeSeries",
        "stacked": false,
        "metrics": [
          ["VOW/THLI", "crossframework.failure_rate", { "label": "失敗率 (%)", "color": "#d62728" }]
        ],
        "region": "ap-northeast-1",
        "period": 3600,
        "stat": "Average",
        "annotations": {
          "horizontal": [
            { "value": 30, "label": "アラート閾値", "color": "#d62728" }
          ]
        }
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 13,
      "width": 12,
      "height": 6,
      "properties": {
        "title": "レベル分布ヒストグラム",
        "view": "bar",
        "metrics": [
          ["VOW/THLI", "level.beginner_count", { "label": "Beginner (0-49)", "color": "#2ca02c" }],
          ["VOW/THLI", "level.intermediate_count", { "label": "Intermediate (50-99)", "color": "#1f77b4" }],
          ["VOW/THLI", "level.advanced_count", { "label": "Advanced (100-149)", "color": "#ff7f0e" }],
          ["VOW/THLI", "level.expert_count", { "label": "Expert (150-199)", "color": "#d62728" }]
        ],
        "region": "ap-northeast-1",
        "period": 86400,
        "stat": "Maximum"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 13,
      "width": 12,
      "height": 6,
      "properties": {
        "title": "OpenAI API エラー率",
        "view": "timeSeries",
        "stacked": false,
        "metrics": [
          ["VOW/THLI", "openai.error_rate", { "label": "エラー率 (%)", "color": "#d62728" }]
        ],
        "region": "ap-northeast-1",
        "period": 3600,
        "stat": "Average",
        "annotations": {
          "horizontal": [
            { "value": 10, "label": "アラート閾値", "color": "#d62728" }
          ]
        }
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 19,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "クォータ使用状況",
        "view": "timeSeries",
        "stacked": true,
        "metrics": [
          ["VOW/THLI", "quota.free_used", { "label": "フリープラン使用", "color": "#1f77b4" }],
          ["VOW/THLI", "quota.premium_used", { "label": "プレミアム使用", "color": "#2ca02c" }]
        ],
        "region": "ap-northeast-1",
        "period": 86400,
        "stat": "Sum"
      }
    },
    {
      "type": "metric",
      "x": 8,
      "y": 19,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "クォータ枯渇ユーザー数",
        "view": "timeSeries",
        "metrics": [
          ["VOW/THLI", "quota.exhausted_users", { "label": "枯渇ユーザー", "color": "#ff7f0e" }]
        ],
        "region": "ap-northeast-1",
        "period": 86400,
        "stat": "Maximum"
      }
    },
    {
      "type": "metric",
      "x": 16,
      "y": 19,
      "width": 8,
      "height": 6,
      "properties": {
        "title": "ベビーステップ採用率",
        "view": "pie",
        "metrics": [
          ["VOW/THLI", "babystep.lv50_accepted", { "label": "Lv.50採用" }],
          ["VOW/THLI", "babystep.lv10_accepted", { "label": "Lv.10採用" }],
          ["VOW/THLI", "babystep.dismissed", { "label": "却下" }]
        ],
        "region": "ap-northeast-1",
        "period": 2592000,
        "stat": "Sum"
      }
    }
  ]
}
```

### ダッシュボード作成コマンド

```bash
# ダッシュボードJSONをファイルに保存
cat > thli-dashboard.json << 'EOF'
{
  "widgets": [
    ... (上記のJSON)
  ]
}
EOF

# CloudWatchダッシュボードを作成
aws cloudwatch put-dashboard \
  --dashboard-name "THLI-24-Monitoring" \
  --dashboard-body file://thli-dashboard.json \
  --region ap-northeast-1
```

---

## アラート設定

### 1. Firewall発動率アラート（> 50%）

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "THLI-Firewall-High-Trigger-Rate" \
  --alarm-description "Missingness Firewall発動率が50%を超えています。プロンプトの改善が必要な可能性があります。" \
  --metric-name "firewall.trigger_rate" \
  --namespace "VOW/THLI" \
  --statistic Average \
  --period 3600 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:vow-alerts" \
  --region ap-northeast-1
```

**対応手順:**
1. 最近の評価ログを確認し、どのファクトが不足しているか特定
2. プロンプトの質問文を改善
3. VOI質問の優先順位を見直し

### 2. クロスフレームワーク ゲート失敗率アラート（> 30%）

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "THLI-CrossFramework-High-Failure-Rate" \
  --alarm-description "クロスフレームワーク検証の失敗率が30%を超えています。評価精度に問題がある可能性があります。" \
  --metric-name "crossframework.failure_rate" \
  --namespace "VOW/THLI" \
  --statistic Average \
  --period 3600 \
  --threshold 30 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:vow-alerts" \
  --region ap-northeast-1
```

**対応手順:**
1. thli_validation_logテーブルで失敗パターンを分析
2. 特定のドメイン（認知/身体/時間/社会）で偏りがないか確認
3. スコアリングアルゴリズムの調整を検討

### 3. OpenAI APIエラー率アラート（> 10%）

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "THLI-OpenAI-High-Error-Rate" \
  --alarm-description "OpenAI APIのエラー率が10%を超えています。サービス障害の可能性があります。" \
  --metric-name "openai.error_rate" \
  --namespace "VOW/THLI" \
  --statistic Average \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 3 \
  --alarm-actions "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:vow-alerts" \
  --region ap-northeast-1
```

**対応手順:**
1. OpenAIステータスページを確認: https://status.openai.com/
2. レート制限に達していないか確認
3. 必要に応じて評価機能を一時停止

### 4. 評価完了率低下アラート（< 50%）

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "THLI-Low-Completion-Rate" \
  --alarm-description "評価完了率が50%を下回っています。ユーザー体験に問題がある可能性があります。" \
  --metric-name "assessment.completion_rate" \
  --namespace "VOW/THLI" \
  --statistic Average \
  --period 86400 \
  --threshold 50 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:vow-alerts" \
  --region ap-northeast-1
```

**対応手順:**
1. 中断された評価のログを分析
2. ユーザーフィードバックを確認
3. 評価フローのUX改善を検討

### SNSトピック作成

```bash
# アラート通知用SNSトピックを作成
aws sns create-topic --name vow-alerts --region ap-northeast-1

# メール通知を追加
aws sns subscribe \
  --topic-arn "arn:aws:sns:ap-northeast-1:ACCOUNT_ID:vow-alerts" \
  --protocol email \
  --notification-endpoint "alerts@example.com" \
  --region ap-northeast-1
```

---

## ログ分析

### CloudWatch Logs Insightsクエリ

#### 評価成功率の分析

```sql
fields @timestamp, @message
| filter @message like /thli.assessment/
| stats count(*) as total,
        sum(case when status = 'completed' then 1 else 0 end) as completed,
        sum(case when status = 'failed' then 1 else 0 end) as failed
  by bin(1h)
| sort @timestamp desc
```

#### Firewall発動パターンの分析

```sql
fields @timestamp, habit_id, ici, firewall_triggered, missing_facts
| filter @message like /thli.firewall/
| filter firewall_triggered = true
| stats count(*) as trigger_count by missing_facts
| sort trigger_count desc
| limit 10
```

#### クロスフレームワーク偏差の分析

```sql
fields @timestamp, habit_id, thli_score, tlx_score, srbai_score, comb_score, gate_status
| filter @message like /thli.crossframework/
| filter gate_status = 'fail'
| stats avg(abs(thli_score - tlx_score)) as avg_tlx_deviation,
        avg(abs(thli_score - srbai_score)) as avg_srbai_deviation,
        avg(abs(thli_score - comb_score)) as avg_comb_deviation
  by bin(1d)
```

#### OpenAI APIエラーの分析

```sql
fields @timestamp, error_type, error_message, retry_count
| filter @message like /openai.api.error/
| stats count(*) as error_count by error_type
| sort error_count desc
```

### ログ保持期間設定

```bash
# THLI関連ログの保持期間を90日に設定
aws logs put-retention-policy \
  --log-group-name "/aws/lambda/vow-development-api" \
  --retention-in-days 90 \
  --region ap-northeast-1

aws logs put-retention-policy \
  --log-group-name "/aws/lambda/vow-production-api" \
  --retention-in-days 90 \
  --region ap-northeast-1
```

---

## メトリクス送信コード例

バックエンドでメトリクスを送信するためのコード例：

```typescript
// backend/src/utils/metrics.ts
import { CloudWatch } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatch({ region: 'ap-northeast-1' });

export async function publishMetric(
  metricName: string,
  value: number,
  unit: 'Count' | 'Percent' | 'Seconds' | 'None' = 'Count'
): Promise<void> {
  await cloudwatch.putMetricData({
    Namespace: 'VOW/THLI',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
      },
    ],
  });
}

// 使用例
export async function recordAssessmentCompleted(durationSeconds: number): Promise<void> {
  await Promise.all([
    publishMetric('assessment.completed', 1, 'Count'),
    publishMetric('assessment.duration_seconds', durationSeconds, 'Seconds'),
  ]);
}

export async function recordFirewallTriggered(ici: number): Promise<void> {
  await Promise.all([
    publishMetric('firewall.triggered', 1, 'Count'),
    publishMetric('firewall.ici', ici, 'None'),
  ]);
}

export async function recordCrossFrameworkResult(
  gateStatus: 'pass' | 'fail',
  deviation: number
): Promise<void> {
  await Promise.all([
    publishMetric(`crossframework.gate_${gateStatus}`, 1, 'Count'),
    publishMetric('crossframework.deviation', deviation, 'None'),
  ]);
}
```

---

## 関連ドキュメント

- [THLI-24 API リファレンス](./THLI_API_REFERENCE.md)
- [THLI-24 ユーザーガイド](./THLI_USER_GUIDE.md)
- [デプロイ手順](./DEPLOYMENT_GUIDE.md)
