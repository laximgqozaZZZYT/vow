/**
 * Task Template Type Definitions
 * TASK-2.2: テンプレートシステムの型定義
 */

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TemplateCategory = 'coaching' | 'development' | 'analysis';
export type AgentRole = 'manager' | 'developer' | 'tester' | 'analyst';

export interface TaskTemplate {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  descriptionJa: string;
  icon: string;
  category: TemplateCategory;
  defaultPriority: TaskPriority;
  defaultTags: string[];
  promptTemplate: string;
  variables: TemplateVariable[];
  requiredAgentRole?: AgentRole;
  fallbackToManager?: boolean;
}

export interface TemplateVariable {
  key: string;
  label: string;
  labelJa: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  options?: string[];
  defaultValue?: string | number;
}
