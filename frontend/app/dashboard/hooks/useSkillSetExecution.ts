'use client';

/**
 * useSkillSetExecution Hook
 *
 * Manages the execution lifecycle of a SkillSet through the Remote CLI (MCP chat).
 * Responsibilities:
 * 1. Builds an execution prompt from a SkillSet using skillSetPromptBuilder
 * 2. Sends it to the Remote CLI via sendMessage
 * 3. Tracks execution status (executingSkillSetId)
 * 4. Monitors SSE messages for progress reports
 * 5. Updates SkillSet status on completion/error
 *
 * @module hooks/useSkillSetExecution
 */

import { useState, useCallback, useRef } from 'react';
import type { SkillSet, SkillSetStatus, SkillSetProgressReport, SkillSetProgressReply } from '../types';
import type { MastraMessage } from './useMcpChat';
import { buildExecutionPrompt, extractProgressReport, resolveSkillSetIdByName } from '../utils/skillSetPromptBuilder';

// ============================================================================
// Types
// ============================================================================

export interface UseSkillSetExecutionOptions {
  /** MCP chat's sendMessage function */
  sendMessage: (message: string) => Promise<void>;
  /** Function to change skill set status */
  changeStatus: (id: string, status: SkillSetStatus) => Promise<void>;
  /** Whether the current provider is Remote CLI */
  isRemoteCli: boolean;
  /** MCP connection state */
  isConnected: boolean;
  /** All skill sets for task name → ID resolution */
  skillSets: SkillSet[];
}

export interface UseSkillSetExecutionReturn {
  /** Currently executing skill set ID */
  executingSkillSetId: string | null;
  /** Progress map (skillSetId -> progress report) */
  progressMap: Map<string, SkillSetProgressReport>;
  /** Execute a skill set */
  execute: (skillSet: SkillSet) => Promise<void>;
  /** Cancel execution */
  cancel: () => void;
  /** Handle incoming SSE message (detect progress reports) */
  handleMessage: (message: MastraMessage) => void;
  /** Error state */
  error: string | null;
  /** Clear error */
  clearError: () => void;
  /** Pending reply candidates from waiting status */
  pendingReplies: SkillSetProgressReply[];
  /** Skill set ID associated with pending replies */
  pendingReplySkillSetId: string | null;
  /** Clear pending replies */
  clearPendingReplies: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useSkillSetExecution(
  options: UseSkillSetExecutionOptions,
): UseSkillSetExecutionReturn {
  const { sendMessage, changeStatus, isRemoteCli, isConnected, skillSets } = options;

  // State
  const [executingSkillSetId, setExecutingSkillSetId] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, SkillSetProgressReport>>(
    () => new Map(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingReplies, setPendingReplies] = useState<SkillSetProgressReply[]>([]);
  const [pendingReplySkillSetId, setPendingReplySkillSetId] = useState<string | null>(null);

  // Refs to keep handleMessage stable and avoid infinite re-render loops
  const skillSetsRef = useRef(skillSets);
  skillSetsRef.current = skillSets;
  const changeStatusRef = useRef(changeStatus);
  changeStatusRef.current = changeStatus;
  const executingIdRef = useRef(executingSkillSetId);
  executingIdRef.current = executingSkillSetId;

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearPendingReplies = useCallback(() => {
    setPendingReplies([]);
    setPendingReplySkillSetId(null);
  }, []);

  /**
   * Execute a skill set by building a prompt and sending it to the Remote CLI.
   *
   * Guards:
   * - Remote CLI must be the active provider and connected
   * - No other skill set can be executing concurrently
   */
  const execute = useCallback(
    async (skillSet: SkillSet): Promise<void> => {
      // Guard: must be Remote CLI and connected
      if (!isRemoteCli || !isConnected) {
        setError('Remote CLI is not connected. Please connect first.');
        return;
      }

      // Guard: only one execution at a time
      if (executingSkillSetId !== null) {
        setError('Another skill set is executing');
        return;
      }

      setError(null);

      // Build the execution prompt
      const prompt = buildExecutionPrompt(skillSet);

      // Set execution state
      setExecutingSkillSetId(skillSet.id);

      try {
        // Update the skill set status to in_progress
        await changeStatus(skillSet.id, 'in_progress');

        // Send prompt to Remote CLI
        await sendMessage(prompt);
      } catch (err) {
        // Reset execution state on error
        setExecutingSkillSetId(null);
        const message = err instanceof Error ? err.message : String(err);
        setError(`Execution failed: ${message}`);
      }
    },
    [isRemoteCli, isConnected, executingSkillSetId, sendMessage, changeStatus],
  );

  /**
   * Cancel the current execution.
   *
   * Resets the executingSkillSetId. Actual stream cancellation is handled
   * by the caller via useMcpChat's cancelStream.
   */
  const cancel = useCallback(() => {
    setExecutingSkillSetId(null);
  }, []);

  // handleMessage uses refs for external deps to maintain a stable reference
  // and prevent infinite re-render loops (useEffect → setState → re-render → useEffect)
  const handleMessage = useCallback(
    (message: MastraMessage): void => {
      // Only process assistant messages
      if (message.role !== 'assistant') return;

      // Try to extract a progress report from the message content
      const report = extractProgressReport(message.content);
      if (!report) return;

      // Resolve skillSetId from taskName if empty
      const currentSkillSets = skillSetsRef.current;
      let resolvedId = report.skillSetId;
      if ((!resolvedId || resolvedId === '') && report.taskName) {
        resolvedId = resolveSkillSetIdByName(report.taskName, currentSkillSets) ?? '';
      }
      if (!resolvedId) return;

      // Update the progress map
      setProgressMap((prev) => {
        const next = new Map(prev);
        next.set(resolvedId, { ...report, skillSetId: resolvedId });
        return next;
      });

      // Handle statuses (with guards to avoid redundant API calls)
      if (report.status === 'done') {
        const ss = currentSkillSets.find(s => s.id === resolvedId);
        if (ss && ss.status !== 'done') {
          changeStatusRef.current(resolvedId, 'done').catch((err) => {
            console.error('[useSkillSetExecution] Failed to update status to done:', err);
          });
        }
        if (executingIdRef.current === resolvedId) setExecutingSkillSetId(null);
      } else if (report.status === 'error') {
        setError(report.message);
        if (executingIdRef.current === resolvedId) setExecutingSkillSetId(null);
      } else if (report.status === 'in_progress') {
        // Auto-transition from todo to in_progress
        const ss = currentSkillSets.find(s => s.id === resolvedId);
        if (ss && ss.status === 'todo') {
          changeStatusRef.current(resolvedId, 'in_progress').catch(console.error);
        }
      } else if (report.status === 'waiting') {
        // Store reply candidates
        setPendingReplies(report.replies ?? []);
        setPendingReplySkillSetId(resolvedId);
      }
    },
    [], // Stable reference - all external deps accessed via refs
  );

  return {
    executingSkillSetId,
    progressMap,
    execute,
    cancel,
    handleMessage,
    error,
    clearError,
    pendingReplies,
    pendingReplySkillSetId,
    clearPendingReplies,
  };
}

export default useSkillSetExecution;
