/**
 * Task Templates Data
 * TASK-2.2: システムタスクテンプレート定義
 */

import type {
  TaskTemplate,
  TemplateCategory,
} from '../types/template.types';

/**
 * System Task Templates
 * 5つのシステムテンプレートを定義
 */
export const taskTemplates: TaskTemplate[] = [
  // 1. habit-analysis (習慣分析)
  {
    id: 'habit-analysis',
    name: 'Habit Analysis',
    nameJa: '習慣分析',
    description: 'Analyze your habits and patterns over a specified period',
    descriptionJa: '指定期間の習慣とパターンを分析します',
    icon: 'chart-bar',
    category: 'coaching',
    defaultPriority: 'normal',
    defaultTags: ['analysis', 'habits', 'self-improvement'],
    promptTemplate: `{{period}}間の習慣データを分析し、以下の観点でレポートを作成してください：
- 達成率の高い習慣と低い習慣
- 時間帯別のパフォーマンス傾向
- 改善のための具体的なアドバイス`,
    variables: [
      {
        key: 'period',
        label: 'Analysis Period',
        labelJa: '分析期間',
        type: 'select',
        required: true,
        options: ['週', '月'],
        defaultValue: '週',
      },
    ],
    requiredAgentRole: 'analyst',
    fallbackToManager: true,
  },

  // 2. weekly-review (週次レビュー)
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    nameJa: '週次レビュー',
    description: 'Generate a comprehensive weekly review of your activities',
    descriptionJa: '今週の活動を振り返り、総合的なレビューを生成します',
    icon: 'calendar-week',
    category: 'coaching',
    defaultPriority: 'normal',
    defaultTags: ['review', 'weekly', 'reflection'],
    promptTemplate: `今週の活動を振り返り、以下の項目でレビューを作成してください：
- 今週の達成事項
- 未完了のタスクとその理由
- 来週への改善点と目標
- 全体的な振り返りコメント`,
    variables: [],
    requiredAgentRole: 'analyst',
    fallbackToManager: true,
  },

  // 3. goal-planning (ゴール設計)
  {
    id: 'goal-planning',
    name: 'Goal Planning',
    nameJa: 'ゴール設計',
    description: 'Create a detailed plan to achieve your goal',
    descriptionJa: '目標達成のための詳細な計画を作成します',
    icon: 'target',
    category: 'coaching',
    defaultPriority: 'high',
    defaultTags: ['planning', 'goals', 'strategy'],
    promptTemplate: `「{{goalName}}」を達成するための計画を作成してください：
- 目標の明確化とSMART化
- マイルストーンの設定
- 必要なリソースとスキル
- 想定される障害とその対策
- 具体的なアクションプラン`,
    variables: [
      {
        key: 'goalName',
        label: 'Goal Name',
        labelJa: '目標名',
        type: 'text',
        required: true,
      },
    ],
    requiredAgentRole: 'manager',
  },

  // 4. spec-draft (SPEC作成)
  {
    id: 'spec-draft',
    name: 'Spec Draft',
    nameJa: 'SPEC作成',
    description: 'Draft a specification document for a new feature',
    descriptionJa: '新機能の仕様書ドラフトを作成します',
    icon: 'document-text',
    category: 'development',
    defaultPriority: 'high',
    defaultTags: ['spec', 'documentation', 'planning'],
    promptTemplate: `「{{featureName}}」の仕様書を作成してください。
スコープ: {{scope}}

以下の項目を含めてください：
- 機能概要
- ユースケース
- 技術要件
- API設計（該当する場合）
- UI/UX要件（該当する場合）
- テスト計画
- リスクと制約`,
    variables: [
      {
        key: 'featureName',
        label: 'Feature Name',
        labelJa: '機能名',
        type: 'text',
        required: true,
      },
      {
        key: 'scope',
        label: 'Scope',
        labelJa: 'スコープ',
        type: 'select',
        required: true,
        options: ['small', 'medium', 'large'],
        defaultValue: 'medium',
      },
    ],
    requiredAgentRole: 'developer',
    fallbackToManager: true,
  },

  // 5. code-review (コードレビュー)
  {
    id: 'code-review',
    name: 'Code Review',
    nameJa: 'コードレビュー',
    description: 'Request a code review for a specific branch',
    descriptionJa: '指定ブランチのコードレビューをリクエストします',
    icon: 'code',
    category: 'development',
    defaultPriority: 'normal',
    defaultTags: ['code-review', 'quality', 'development'],
    promptTemplate: `「{{branchName}}」ブランチのコードレビューを実施してください：
- コード品質の評価
- ベストプラクティスの遵守確認
- パフォーマンスの考慮点
- セキュリティ上の懸念
- 改善提案`,
    variables: [
      {
        key: 'branchName',
        label: 'Branch Name',
        labelJa: 'ブランチ名',
        type: 'text',
        required: true,
      },
    ],
    requiredAgentRole: 'developer',
    fallbackToManager: true,
  },
];

/**
 * Fill template with provided variables
 * テンプレートのプレースホルダーを変数で置換
 */
export function fillTemplate(
  template: TaskTemplate,
  variables: Record<string, string | number>
): { title: string; description: string } {
  let description = template.promptTemplate;

  // Replace all {{variable}} placeholders with actual values
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    description = description.replace(placeholder, String(value));
  }

  // Also apply default values for any remaining placeholders
  for (const variable of template.variables) {
    if (variable.defaultValue !== undefined && !(variable.key in variables)) {
      const placeholder = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
      description = description.replace(placeholder, String(variable.defaultValue));
    }
  }

  return {
    title: template.nameJa,
    description,
  };
}

/**
 * Get templates by category
 * カテゴリでテンプレートをフィルタリング
 */
export function getTemplatesByCategory(category: TemplateCategory): TaskTemplate[] {
  return taskTemplates.filter((template) => template.category === category);
}

/**
 * Get template by ID
 * IDでテンプレートを取得
 */
export function getTemplateById(id: string): TaskTemplate | undefined {
  return taskTemplates.find((template) => template.id === id);
}
