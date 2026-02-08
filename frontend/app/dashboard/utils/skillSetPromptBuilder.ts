/**
 * Skill Set Prompt Builder
 *
 * Builds execution prompts from SkillSet data for Remote CLI,
 * and extracts progress reports from Remote CLI output.
 *
 * @module skillSetPromptBuilder
 */

import type {
  SkillSet,
  SkillSetProgressReport,
} from '../types';

// ============================================================================
// Prompt Builder
// ============================================================================

/**
 * Build an execution prompt from a SkillSet for Remote CLI.
 *
 * The prompt is structured as a single Markdown document with four sections:
 * 1. Context      - Goal / Habit information (if any)
 * 2. Main prompt  - Note content (Markdown)
 * 3. Sub-instructions - Sticky'n list (numbered)
 * 4. Progress reporting instructions (JSON format spec)
 *
 * @param skillSet - The skill set to build a prompt for
 * @returns A single Markdown string ready to send to Remote CLI
 */
export function buildExecutionPrompt(skillSet: SkillSet): string {
  const sections: string[] = [];

  // ── 1. Context: Goal / Habit info ────────────────────────────────────────
  const goalNames = (skillSet.goals ?? [])
    .map((g) => g.goal?.name)
    .filter(Boolean);
  const habitNames = (skillSet.habits ?? [])
    .map((h) => h.habit?.name)
    .filter(Boolean);

  if (goalNames.length > 0 || habitNames.length > 0) {
    const contextLines: string[] = ['## Context'];
    if (goalNames.length > 0) {
      contextLines.push(`**Goals:** ${goalNames.join(', ')}`);
    }
    if (habitNames.length > 0) {
      contextLines.push(`**Habits:** ${habitNames.join(', ')}`);
    }
    sections.push(contextLines.join('\n'));
  }

  // ── 2. Main prompt: Note content ─────────────────────────────────────────
  if (skillSet.note) {
    const noteLines: string[] = [
      `## ${skillSet.note.title}`,
      '',
      skillSet.note.content,
    ];
    sections.push(noteLines.join('\n'));
  } else if (skillSet.description) {
    sections.push(`## Instructions\n\n${skillSet.description}`);
  }

  // ── 3. Sub-instructions: Sticky'n list ───────────────────────────────────
  const stickies = (skillSet.stickies ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder);

  if (stickies.length > 0) {
    const stepLines: string[] = ['## Steps'];
    stickies.forEach((item, idx) => {
      const label = item.sticky?.name ?? `Step ${idx + 1}`;
      const desc = item.sticky?.description;
      stepLines.push(`${idx + 1}. ${label}${desc ? ` - ${desc}` : ''}`);
    });
    sections.push(stepLines.join('\n'));
  }

  // ── 4. Progress reporting instructions ───────────────────────────────────
  const totalSteps = stickies.length || 1;
  const progressSection = [
    '## Progress Reporting',
    '',
    'After completing each major step, output a progress report as a fenced JSON block.',
    'Use this exact format:',
    '',
    '```json',
    JSON.stringify(
      {
        type: 'skill_set_progress',
        skillSetId: skillSet.id,
        status: 'in_progress',
        progress: 50,
        message: 'Step description',
        stepCurrent: 2,
        stepTotal: totalSteps,
      },
      null,
      2,
    ),
    '```',
    '',
    'Field definitions:',
    '- `type`: Always `"skill_set_progress"`',
    `- \`skillSetId\`: Always \`"${skillSet.id}"\``,
    '- `status`: `"in_progress"` while working, `"done"` when finished, `"error"` on failure',
    '- `progress`: Percentage 0-100',
    '- `message`: Human-readable description of the current step',
    '- `stepCurrent`: Current step number (1-based)',
    `- \`stepTotal\`: Total number of steps (${totalSteps})`,
    '',
    '**Important**: When all steps are complete, first describe the results clearly in plain text, then send a final report with `status: "done"` and `progress: 100`.',
    'Always show the actual output/results to the user before the final done JSON block.',
  ];
  sections.push(progressSection.join('\n'));

  // ── Assemble ─────────────────────────────────────────────────────────────
  const header = `# Skill Set: ${skillSet.name}`;
  return [header, '', ...sections].join('\n\n');
}

// ============================================================================
// Progress Report Extractor
// ============================================================================

/**
 * Extract a SkillSetProgressReport from message text.
 *
 * Scans the text for fenced JSON code blocks (```json ... ```) or
 * raw JSON objects containing `"type": "skill_set_progress"` and
 * returns the first valid match as a SkillSetProgressReport.
 *
 * @param text - Raw text output from Remote CLI
 * @returns Parsed progress report or null if none found
 */
export function extractProgressReport(
  text: string,
): SkillSetProgressReport | null {
  if (!text || !text.includes('skill_set_progress')) {
    return null;
  }

  // Strategy 1: Try fenced JSON code blocks
  const fencedPattern = /```(?:json)?\s*\n?([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fencedPattern.exec(text)) !== null) {
    const parsed = tryParseProgressJson(match[1]);
    if (parsed) return parsed;
  }

  // Strategy 2: Try bare JSON objects containing the type marker
  const barePattern = /\{[^{}]*"type"\s*:\s*"skill_set_progress"[^{}]*\}/g;
  while ((match = barePattern.exec(text)) !== null) {
    const parsed = tryParseProgressJson(match[0]);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Attempt to parse a string as a SkillSetProgressReport.
 *
 * @param raw - Raw JSON string candidate
 * @returns Validated progress report or null
 */
function tryParseProgressJson(raw: string): SkillSetProgressReport | null {
  try {
    const obj = JSON.parse(raw.trim());
    if (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'skill_set_progress' &&
      typeof obj.skillSetId === 'string' &&
      typeof obj.status === 'string' &&
      typeof obj.progress === 'number' &&
      typeof obj.message === 'string' &&
      ['in_progress', 'done', 'error', 'waiting'].includes(obj.status)
    ) {
      const report: SkillSetProgressReport = {
        type: 'skill_set_progress',
        skillSetId: obj.skillSetId,
        status: obj.status,
        progress: obj.progress,
        message: obj.message,
      };
      if (typeof obj.taskName === 'string') {
        report.taskName = obj.taskName;
      }
      if (Array.isArray(obj.replies)) {
        report.replies = obj.replies.filter(
          (r: unknown) =>
            r &&
            typeof r === 'object' &&
            typeof (r as Record<string, unknown>).label === 'string',
        );
      }
      return report;
    }
  } catch {
    // Not valid JSON, ignore
  }
  return null;
}

// ============================================================================
// Task List Prompt Builder
// ============================================================================

/**
 * Build a task list prompt section for injecting into system prompts.
 */
export function buildTaskListPrompt(
  skillSets: SkillSet[],
  locale: 'ja' | 'en' = 'ja',
): string {
  if (skillSets.length === 0) return '';

  const header = locale === 'ja'
    ? '## 現在のタスク一覧'
    : '## Current Task List';

  const statusLabel = (s: string) => {
    const map: Record<string, string> = locale === 'ja'
      ? { todo: '未着手', in_progress: '実行中', done: '完了' }
      : { todo: 'Todo', in_progress: 'In Progress', done: 'Done' };
    return map[s] || s;
  };

  const rows = skillSets.map((ss, i) =>
    `| ${i + 1} | ${ss.name} | ${statusLabel(ss.status)} | ${ss.description || '-'} |`
  );

  return [
    header,
    '',
    locale === 'ja'
      ? '| # | タスク名 | ステータス | 説明 |'
      : '| # | Task Name | Status | Description |',
    '|---|----------|-----------|------|',
    ...rows,
    '',
  ].join('\n');
}

/**
 * Resolve a SkillSet ID by its name (case-insensitive match).
 */
export function resolveSkillSetIdByName(
  taskName: string,
  skillSets: SkillSet[],
): string | null {
  const normalized = taskName.trim().toLowerCase();
  const match = skillSets.find(ss => ss.name.trim().toLowerCase() === normalized);
  return match?.id ?? null;
}
