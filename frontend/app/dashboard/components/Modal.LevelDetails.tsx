"use client";

/**
 * Modal.LevelDetails Component
 * 
 * Displays full THLI-24 assessment details including:
 * - Level number and tier
 * - All 24 variables with scores and stoplights
 * - O/E/C estimates
 * - Cross-framework scores (TLX, SRBAI, COM-B)
 * - Assessment timestamp
 * 
 * @module Modal.LevelDetails
 * 
 * Validates: Requirements 8.3, 14.3
 */

import React from 'react';
import LevelBadge, { calculateTier, getTierColors, type LevelTier } from './LevelBadge';

// THLI-24 Variable domains
export type THLIDomain = 'cognitive' | 'physical' | 'temporal' | 'social';

// Stoplight status
export type StoplightStatus = 'green' | 'yellow' | 'red';

// THLI-24 Variable interface
export interface THLIVariable {
  id: string; // e.g., "①", "②", ..., "㉔"
  name: string;
  nameJa: string;
  domain: THLIDomain;
  score: number; // From discrete set {0.0, 1.4, 2.8, 4.1, 5.5, 6.9, 8.3}
  stoplight: StoplightStatus;
  rationale?: string;
  causingFacts?: string[];
}

// Cross-framework scores
export interface CrossFrameworkScores {
  tlxScore?: number;
  srbaiScore?: number;
  combScore?: number;
  gateStatus?: 'pass' | 'fail';
}

// Level assessment data structure
export interface LevelAssessmentData {
  facts?: Record<string, any>;
  variables?: THLIVariable[];
  ici?: number;
  abUsed?: number;
  firewallTriggered?: boolean;
  oLevel?: number;
  eLevelRange?: { min: number; max: number };
  cLevel?: number;
  crossFramework?: CrossFrameworkScores;
  promptVersion?: string;
  assessedAt?: string;
}

export interface LevelDetailsModalProps {
  open: boolean;
  onClose: () => void;
  habitName: string;
  level: number | null;
  levelTier?: LevelTier;
  assessmentData?: LevelAssessmentData;
  lastAssessedAt?: string;
  onViewHistory?: () => void;
  onReassess?: () => void;
}

// Domain labels
const domainLabels: Record<THLIDomain, { en: string; ja: string; color: string }> = {
  cognitive: { en: 'Cognitive', ja: '認知', color: 'text-purple-600 dark:text-purple-400' },
  physical: { en: 'Physical', ja: '身体', color: 'text-blue-600 dark:text-blue-400' },
  temporal: { en: 'Temporal', ja: '時間', color: 'text-orange-600 dark:text-orange-400' },
  social: { en: 'Social', ja: '社会', color: 'text-green-600 dark:text-green-400' },
};

// Stoplight colors
const stoplightColors: Record<StoplightStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

// Default 24 variables (used when no assessment data)
const defaultVariables: THLIVariable[] = [
  { id: '①', name: 'Cognitive Load', nameJa: '認知負荷', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '②', name: 'Decision Complexity', nameJa: '意思決定の複雑さ', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '③', name: 'Learning Curve', nameJa: '学習曲線', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '④', name: 'Attention Required', nameJa: '必要な注意力', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '⑤', name: 'Memory Demand', nameJa: '記憶の要求', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '⑥', name: 'Planning Required', nameJa: '計画の必要性', domain: 'cognitive', score: 0, stoplight: 'green' },
  { id: '⑦', name: 'Physical Effort', nameJa: '身体的努力', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑧', name: 'Skill Required', nameJa: '必要なスキル', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑨', name: 'Tools/Resources', nameJa: '道具・リソース', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑩', name: 'Travel Distance', nameJa: '移動距離', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑪', name: 'Setup/Cleanup', nameJa: '準備・片付け', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑫', name: 'Complexity', nameJa: '複雑さ', domain: 'physical', score: 0, stoplight: 'green' },
  { id: '⑬', name: 'Duration', nameJa: '所要時間', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑭', name: 'Time Window', nameJa: '時間枠', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑮', name: 'Scheduling Difficulty', nameJa: 'スケジュール難易度', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑯', name: 'Interruption Risk', nameJa: '中断リスク', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑰', name: 'Recovery Time', nameJa: '回復時間', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑱', name: 'Frequency', nameJa: '頻度', domain: 'temporal', score: 0, stoplight: 'green' },
  { id: '⑲', name: 'Social Visibility', nameJa: '社会的可視性', domain: 'social', score: 0, stoplight: 'green' },
  { id: '⑳', name: 'Accountability', nameJa: '責任', domain: 'social', score: 0, stoplight: 'green' },
  { id: '㉑', name: 'Social Support', nameJa: '社会的サポート', domain: 'social', score: 0, stoplight: 'green' },
  { id: '㉒', name: 'Social Pressure', nameJa: '社会的プレッシャー', domain: 'social', score: 0, stoplight: 'green' },
  { id: '㉓', name: 'Failure Consequence', nameJa: '失敗の結果', domain: 'social', score: 0, stoplight: 'green' },
  { id: '㉔', name: 'Avoidance Signals', nameJa: '回避シグナル', domain: 'social', score: 0, stoplight: 'green' },
];

/**
 * Format date for display
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Variable row component
 */
function VariableRow({ variable }: { variable: THLIVariable }) {
  const domainInfo = domainLabels[variable.domain];
  
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0">
      {/* Stoplight indicator */}
      <div
        className={`w-3 h-3 rounded-full ${stoplightColors[variable.stoplight]} flex-shrink-0`}
        title={variable.stoplight}
      />
      
      {/* Variable ID */}
      <span className="w-6 text-xs text-muted-foreground font-mono">
        {variable.id}
      </span>
      
      {/* Variable name */}
      <div className="flex-1 min-w-0">
        <span className="text-sm truncate">{variable.nameJa}</span>
        <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
          ({variable.name})
        </span>
      </div>
      
      {/* Domain badge */}
      <span className={`text-xs ${domainInfo.color} hidden md:inline`}>
        {domainInfo.ja}
      </span>
      
      {/* Score */}
      <span className="w-12 text-right text-sm font-mono font-medium">
        {variable.score.toFixed(1)}
      </span>
    </div>
  );
}

/**
 * O/E/C Estimates display
 */
function OECEstimates({ data }: { data: LevelAssessmentData }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Optimistic */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
        <div className="text-xs text-green-700 dark:text-green-400 mb-1">楽観的 (O)</div>
        <div className="text-xl font-bold text-green-700 dark:text-green-400">
          {data.oLevel ?? '—'}
        </div>
      </div>
      
      {/* Expected */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
        <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">期待値 (E)</div>
        <div className="text-xl font-bold text-blue-700 dark:text-blue-400">
          {data.eLevelRange 
            ? `${data.eLevelRange.min}-${data.eLevelRange.max}`
            : '—'
          }
        </div>
      </div>
      
      {/* Conservative */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
        <div className="text-xs text-orange-700 dark:text-orange-400 mb-1">保守的 (C)</div>
        <div className="text-xl font-bold text-orange-700 dark:text-orange-400">
          {data.cLevel ?? '—'}
        </div>
      </div>
    </div>
  );
}

/**
 * Cross-framework scores display
 */
function CrossFrameworkDisplay({ scores }: { scores?: CrossFrameworkScores }) {
  if (!scores) return null;
  
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2 text-muted-foreground">
        クロスフレームワーク検証
      </h4>
      <div className="grid grid-cols-3 gap-2">
        {/* NASA-TLX */}
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">NASA-TLX</div>
          <div className="text-sm font-medium">{scores.tlxScore ?? '—'}</div>
        </div>
        
        {/* SRBAI */}
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">SRBAI</div>
          <div className="text-sm font-medium">{scores.srbaiScore ?? '—'}</div>
        </div>
        
        {/* COM-B */}
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="text-xs text-muted-foreground">COM-B</div>
          <div className="text-sm font-medium">{scores.combScore ?? '—'}</div>
        </div>
      </div>
      
      {/* Gate status */}
      {scores.gateStatus && (
        <div className={`mt-2 text-xs text-center ${
          scores.gateStatus === 'pass' 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          検証ゲート: {scores.gateStatus === 'pass' ? '✓ 合格' : '✗ 要確認'}
        </div>
      )}
    </div>
  );
}

/**
 * Modal.LevelDetails component
 */
export default function LevelDetailsModal({
  open,
  onClose,
  habitName,
  level,
  levelTier,
  assessmentData,
  lastAssessedAt,
  onViewHistory,
  onReassess,
}: LevelDetailsModalProps) {
  if (!open) return null;

  const tier = levelTier ?? (level !== null ? calculateTier(level) : undefined);
  const tierColors = tier ? getTierColors(tier) : null;
  const variables = assessmentData?.variables ?? defaultVariables;
  
  // Group variables by domain
  const variablesByDomain = variables.reduce((acc, v) => {
    if (!acc[v.domain]) acc[v.domain] = [];
    acc[v.domain].push(v);
    return acc;
  }, {} as Record<THLIDomain, THLIVariable[]>);

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-8 bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg sm:text-xl font-semibold">レベル詳細</h2>
            {level !== null && tier && (
              <LevelBadge level={level} tier={tier} size="md" />
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Habit name */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">習慣名</div>
            <div className="text-lg font-medium">{habitName}</div>
          </div>

          {/* Level not assessed state */}
          {level === null && (
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="text-muted-foreground mb-4">
                この習慣はまだレベル評価されていません
              </div>
              {onReassess && (
                <button
                  onClick={onReassess}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity min-h-[44px]"
                >
                  レベルを測定する
                </button>
              )}
            </div>
          )}

          {/* Assessment data */}
          {level !== null && (
            <>
              {/* O/E/C Estimates */}
              {assessmentData && (
                <div>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    レベル推定値
                  </h3>
                  <OECEstimates data={assessmentData} />
                </div>
              )}

              {/* Assessment metadata */}
              <div className="flex flex-wrap gap-4 text-sm">
                {assessmentData?.ici !== undefined && (
                  <div>
                    <span className="text-muted-foreground">ICI: </span>
                    <span className="font-medium">{(assessmentData.ici * 100).toFixed(0)}%</span>
                  </div>
                )}
                {assessmentData?.abUsed !== undefined && (
                  <div>
                    <span className="text-muted-foreground">AB使用: </span>
                    <span className="font-medium">{assessmentData.abUsed}/6</span>
                  </div>
                )}
                {assessmentData?.promptVersion && (
                  <div>
                    <span className="text-muted-foreground">プロンプト: </span>
                    <span className="font-medium">{assessmentData.promptVersion}</span>
                  </div>
                )}
              </div>

              {/* Cross-framework scores */}
              <CrossFrameworkDisplay scores={assessmentData?.crossFramework} />

              {/* Variables by domain */}
              <div>
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                  THLI-24 変数 (24項目)
                </h3>
                
                {(['cognitive', 'physical', 'temporal', 'social'] as THLIDomain[]).map(domain => {
                  const domainVars = variablesByDomain[domain] ?? [];
                  const domainInfo = domainLabels[domain];
                  
                  return (
                    <div key={domain} className="mb-4">
                      <div className={`text-sm font-medium mb-2 ${domainInfo.color}`}>
                        {domainInfo.ja} ({domainInfo.en})
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2">
                        {domainVars.map(v => (
                          <VariableRow key={v.id} variable={v} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Assessment timestamp */}
              <div className="text-sm text-muted-foreground">
                評価日時: {formatDate(lastAssessedAt ?? assessmentData?.assessedAt)}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="flex gap-2">
            {onViewHistory && (
              <button
                onClick={onViewHistory}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
              >
                履歴を見る
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {onReassess && level !== null && (
              <button
                onClick={onReassess}
                className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-md transition-colors min-h-[44px]"
              >
                再評価
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity min-h-[44px]"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
