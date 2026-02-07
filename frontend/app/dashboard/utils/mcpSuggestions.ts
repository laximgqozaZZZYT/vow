/**
 * MCP Server Suggestions Extractor
 *
 * MCPサーバの toolCalls 出力から選択肢データを抽出する。
 * 3つの入力パターンに対応:
 * - suggestions: McpSuggestion[]
 * - options: { label: string; value: string }[]
 * - choices: string[]
 *
 * @module utils/mcpSuggestions
 */

export interface McpSuggestion {
  /** ボタンに表示するラベル */
  label: string;
  /** 送信するコマンド/値 */
  value: string;
  /** オプションのアイコン */
  icon?: string;
}

/**
 * MCP toolCall output の型（ゆるい型定義）
 */
interface ToolCallOutput {
  suggestions?: Array<{ label?: string; value?: string; icon?: string }>;
  options?: Array<{ label?: string; value?: string }>;
  choices?: string[];
  [key: string]: unknown;
}

/**
 * toolCalls 配列からMcpSuggestionを抽出する
 *
 * @param toolCalls - MCP toolCalls配列。各要素に output プロパティがある。
 *                    output は JSON文字列またはオブジェクト。
 * @returns McpSuggestion[] - 抽出された選択肢の配列
 */
export function extractMcpSuggestions(
  toolCalls: Array<{ output?: string | ToolCallOutput | unknown }> | undefined | null
): McpSuggestion[] {
  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  const suggestions: McpSuggestion[] = [];

  for (const tc of toolCalls) {
    if (!tc.output) continue;

    let parsed: ToolCallOutput;

    // output が string の場合、JSONパースを試行
    if (typeof tc.output === 'string') {
      try {
        parsed = JSON.parse(tc.output);
      } catch {
        continue; // パース失敗はスキップ
      }
    } else if (typeof tc.output === 'object' && tc.output !== null) {
      parsed = tc.output as ToolCallOutput;
    } else {
      continue;
    }

    // パターン1: suggestions 配列
    if (Array.isArray(parsed.suggestions)) {
      for (const s of parsed.suggestions) {
        if (s && typeof s === 'object') {
          const label = typeof s.label === 'string' ? s.label : '';
          const value = typeof s.value === 'string' ? s.value : label;
          if (label || value) {
            suggestions.push({
              label: label || value,
              value: value || label,
              icon: typeof s.icon === 'string' ? s.icon : undefined,
            });
          }
        }
      }
    }

    // パターン2: options 配列
    if (Array.isArray(parsed.options)) {
      for (const o of parsed.options) {
        if (o && typeof o === 'object') {
          const label = typeof o.label === 'string' ? o.label : '';
          const value = typeof o.value === 'string' ? o.value : label;
          if (label || value) {
            suggestions.push({
              label: label || value,
              value: value || label,
            });
          }
        }
      }
    }

    // パターン3: choices 文字列配列
    if (Array.isArray(parsed.choices)) {
      for (const c of parsed.choices) {
        if (typeof c === 'string' && c.trim()) {
          suggestions.push({
            label: c.trim(),
            value: c.trim(),
          });
        }
      }
    }
  }

  return suggestions;
}
