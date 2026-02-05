# Category Drilldown (Fukabori) Feature - Requirements

## Overview
- **Feature Name**: Category Drilldown (Fukabori / Deepening)
- **Status**: Implementation Complete
- **Version**: 1.0.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-02-04
- **Author**: vow-spec-architect

---

## Purpose

曖昧な質問や要望に対して、ユーザーの意図を段階的に明確化するための「掘り下げ（フカボリ）」機能を実装する。
すべての掘り下げステップで候補ボタンを表示し、ユーザーが簡単に選択できるようにする。

---

## Functional Requirements

### FR-001: Drilldown Trigger Conditions
以下の情報が不明確な場合、掘り下げモードに入る:
- **Genre (ジャンル)**: 健康、キャリア、学習、趣味など
- **Purpose (目的)**: 何を達成したいのか
- **Candidates (候補)**: 具体的な選択肢
- **Response Type (回答の型)**: Habit提案、Goal設定、アドバイス、情報提供など

### FR-002: Drilldown Flow
```
Step 1: ジャンル確認
  ↓ 候補ボタンで選択
Step 2: 目的確認
  ↓ 候補ボタンで選択
Step 3: 回答の型確認
  ↓ 候補ボタンで選択
Step 4: 適切なエージェントへ引き継ぎ
```

### FR-003: Genre Categories
| ID | Label (JA) | Label (EN) | Icon |
|----|-----------|------------|------|
| health | 健康・運動 | Health & Fitness | :muscle: |
| career | キャリア・仕事 | Career & Work | :briefcase: |
| learning | 学習・スキル | Learning & Skills | :books: |
| hobby | 趣味・創作 | Hobbies & Creation | :art: |
| relationships | 人間関係 | Relationships | :handshake: |
| finance | お金・資産 | Finance & Assets | :moneybag: |
| lifestyle | ライフスタイル | Lifestyle | :house: |
| other | その他 | Other | :question: |

### FR-004: Purpose by Genre

#### Health & Fitness
| ID | Label (JA) | Label (EN) |
|----|-----------|------------|
| lose_weight | 体重を減らしたい | Want to lose weight |
| build_muscle | 筋力をつけたい | Want to build muscle |
| improve_health | 体調を整えたい | Want to improve health |
| reduce_stress | ストレス解消 | Reduce stress |
| improve_sleep | 睡眠を改善したい | Want to improve sleep |
| other | その他 | Other |

#### Career & Work
| ID | Label (JA) | Label (EN) |
|----|-----------|------------|
| get_promoted | 昇進・昇格したい | Want to get promoted |
| change_job | 転職したい | Want to change jobs |
| improve_skills | スキルアップしたい | Want to improve skills |
| productivity | 生産性を上げたい | Want to increase productivity |
| work_life_balance | ワークライフバランス | Work-life balance |
| other | その他 | Other |

#### Learning & Skills
| ID | Label (JA) | Label (EN) |
|----|-----------|------------|
| new_language | 新しい言語を学びたい | Want to learn a new language |
| certification | 資格を取りたい | Want to get certified |
| programming | プログラミングを学びたい | Want to learn programming |
| reading | 読書習慣をつけたい | Want to build reading habit |
| other | その他 | Other |

#### Hobbies & Creation
| ID | Label (JA) | Label (EN) |
|----|-----------|------------|
| start_hobby | 新しい趣味を始めたい | Want to start a new hobby |
| improve_hobby | 趣味のスキルを上げたい | Want to improve hobby skills |
| create_something | 何か作りたい | Want to create something |
| other | その他 | Other |

#### Relationships
| ID | Label (JA) | Label (EN) |
|----|-----------|------------|
| family | 家族との時間を増やしたい | Want more family time |
| friends | 友人関係を広げたい | Want to expand friendships |
| communication | コミュニケーション力を上げたい | Want to improve communication |
| other | その他 | Other |

### FR-005: Response Type Options
| ID | Label (JA) | Label (EN) | Target Agent |
|----|-----------|------------|--------------|
| habit_suggestion | 具体的な習慣を提案 | Suggest specific habits | habit-coach |
| goal_setting | 目標設定をサポート | Support goal setting | goal-planner |
| information | まず情報を知りたい | Want information first | manager |
| advice | アドバイスがほしい | Want advice | manager |

### FR-006: Mandatory Suggestion Buttons
- すべての掘り下げステップで候補ボタン（QuickReply）を必ず表示
- テキスト入力のみでの応答は避ける
- 「その他」オプションも用意してカスタム入力を許可

### FR-007: Drilldown State Management
- 現在の掘り下げステップを追跡
- 選択済みの値（ジャンル、目的、回答の型）を保持
- すべてが確定したら適切なエージェントに引き継ぎ

---

## Non-Functional Requirements

### NFR-001: Response Time
- 候補ボタンは300ms以内に表示
- 掘り下げ判定は100ms以内に完了

### NFR-002: Accessibility
- 候補ボタンはキーボード操作に対応
- スクリーンリーダー対応のaria-label

### NFR-003: Mobile UX
- タッチ操作に適したボタンサイズ（最小44x44px）
- スクロールなしで主要な選択肢が見える

---

## Acceptance Criteria

### AC-001: Genre Selection
- [x] ユーザーが曖昧な質問をした場合、ジャンル選択の候補ボタンが表示される
- [x] 「その他」を選択した場合、自由入力が可能

### AC-002: Purpose Selection
- [x] ジャンル選択後、そのジャンルに応じた目的の候補ボタンが表示される
- [x] 目的の候補は選択したジャンルに適したものである

### AC-003: Response Type Selection
- [x] 目的選択後、回答の型の候補ボタンが表示される
- [x] 選択した回答の型に応じて適切なエージェントに引き継がれる

### AC-004: Complete Flow
- [x] すべての選択が完了した後、適切なエージェント（Habit Coach / Goal Planner）が応答を返す
- [x] 応答には選択した文脈に基づいた具体的な提案が含まれる

### AC-005: Fallback
- [x] 「その他」選択時はテキスト入力フィールドが有効化される
- [x] バックエンド障害時も候補ボタンは表示される（フォールバックデータ）

---

## Dependencies

### Internal Dependencies
- Section.MOC.tsx (GroupChatMessage, QuickReply)
- useMastraAgent.ts
- manager-agent.ts
- habit-coach-agent.ts
- goal-planner-agent.ts

### External Dependencies
- None

---

## Out of Scope
- 多言語対応（英語以外）は本バージョンでは対象外
- 掘り下げ履歴のデータベース永続化
- カスタムカテゴリの追加機能
