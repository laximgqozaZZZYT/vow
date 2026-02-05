/**
 * useSuggestionState - Suggestion state management hook
 *
 * Manages suggestion action states (accepted, snoozed, dismissed) and
 * handles user actions on suggestions.
 *
 * @module hooks/useSuggestionState
 */

import { useState, useCallback } from 'react';

// Types
export type SuggestionStatus = 'pending' | 'accepted' | 'snoozed' | 'dismissed' | 'loading' | 'error';

export interface SuggestionState {
  status: SuggestionStatus;
  error?: string;
}

export interface SnoozedSuggestion {
  id: string;
  messageId: string;
  type: 'habit' | 'goal';
  data: Record<string, unknown>;
  snoozedAt: Date;
}

// Suggestion interface (subset of GroupChatMessage['suggestion'])
export interface Suggestion {
  type: 'habit' | 'goal';
  suggestionType?: 'habit' | 'goal' | 'stickyn' | 'reply';
  data: Record<string, unknown>;
  actions: Array<{ id: string; label: string; variant: 'primary' | 'secondary' | 'ghost' }>;
}

// Modal open functions type
export interface ModalHandlers {
  openHabitModal: (initial: {
    name?: string;
    type?: 'do' | 'avoid';
    goalId?: string | null;
  }) => void;
  openGoalModal: (initial: {
    name?: string;
    parentId?: string | null;
  }) => void;
  openStickyModal: (initial: {
    name?: string;
    description?: string;
    habitId?: string | null;
  }) => void;
}

// Message adder function type
export type MessageAdder = (message: {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'user' | 'agent' | 'coach' | 'system';
  senderIcon?: string;
  content: string;
  timestamp: Date;
}) => void;

// Agent interface (subset of useMastraAgent/useMcpChat return type)
export interface ActiveAgent {
  sendMessage: (content: string) => Promise<void>;
}

export interface UseSuggestionStateOptions {
  locale?: 'ja' | 'en';
  modalHandlers: ModalHandlers;
  addMessage: MessageAdder;
  activeAgent: ActiveAgent;
  goals?: Array<{ id: string; name: string }>;
  roleIcons: Record<string, string>;
}

export interface UseSuggestionStateReturn {
  suggestionStates: Record<string, SuggestionState>;
  snoozedSuggestions: SnoozedSuggestion[];
  handleSuggestionAction: (
    messageId: string,
    actionId: string,
    suggestion: Suggestion
  ) => Promise<void>;
}

/**
 * Hook for managing suggestion states and actions
 */
export function useSuggestionState({
  locale = 'ja',
  modalHandlers,
  addMessage,
  activeAgent,
  goals = [],
  roleIcons,
}: UseSuggestionStateOptions): UseSuggestionStateReturn {
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>({});
  const [snoozedSuggestions, setSnoozedSuggestions] = useState<SnoozedSuggestion[]>([]);

  const handleSuggestionAction = useCallback(async (
    messageId: string,
    actionId: string,
    suggestion: Suggestion
  ) => {
    // Update state to loading
    setSuggestionStates(prev => ({
      ...prev,
      [messageId]: { status: 'loading' },
    }));

    try {
      if (actionId === 'accept') {
        // Determine which modal to open based on suggestionType
        const suggestionType = suggestion.suggestionType || (suggestion.type === 'goal' ? 'goal' : 'habit');

        switch (suggestionType) {
          case 'habit':
            // Open habit modal with pre-filled data
            modalHandlers.openHabitModal({
              name: (suggestion.data.name as string) || '',
              type: (suggestion.data.type as 'do' | 'avoid') || 'do',
              goalId: (suggestion.data.goalId as string) || goals[0]?.id || null,
            });

            addMessage({
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: roleIcons.system,
              content: locale === 'ja'
                ? `📝 「${suggestion.data.name || 'New Habit'}」の詳細を確認してください`
                : `📝 Please review the details for "${suggestion.data.name || 'New Habit'}"`,
              timestamp: new Date(),
            });
            break;

          case 'goal':
            // Open goal modal with pre-filled data
            modalHandlers.openGoalModal({
              name: (suggestion.data.name as string) || '',
              parentId: null,
            });

            addMessage({
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: roleIcons.system,
              content: locale === 'ja'
                ? `🎯 「${suggestion.data.name || 'New Goal'}」の詳細を確認してください`
                : `🎯 Please review the details for "${suggestion.data.name || 'New Goal'}"`,
              timestamp: new Date(),
            });
            break;

          case 'stickyn':
            // Open Sticky'n modal with pre-filled data
            modalHandlers.openStickyModal({
              name: (suggestion.data.name as string) || '',
              description: (suggestion.data.description as string) || (suggestion.data.rationale as string) || '',
              habitId: (suggestion.data.habitId as string) || null,
            });

            addMessage({
              id: `system-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderType: 'system',
              senderIcon: roleIcons.system,
              content: locale === 'ja'
                ? `📌 「${suggestion.data.name || 'New Sticky'}」の詳細を確認してください`
                : `📌 Please review the details for "${suggestion.data.name || 'New Sticky'}"`,
              timestamp: new Date(),
            });
            break;

          case 'reply':
            // Send the suggestion content as a message automatically
            const replyContent = (suggestion.data.name as string) || (suggestion.data.content as string) || '';
            if (replyContent) {
              // Add user message to chat
              addMessage({
                id: `user-${Date.now()}`,
                senderId: 'user',
                senderName: 'You',
                senderType: 'user',
                senderIcon: roleIcons.user,
                content: replyContent,
                timestamp: new Date(),
              });

              // Send to AI
              await activeAgent.sendMessage(replyContent);
            }
            break;

          default:
            // Fallback to habit/goal based on type
            if (suggestion.type === 'habit') {
              modalHandlers.openHabitModal({
                name: (suggestion.data.name as string) || '',
                type: (suggestion.data.type as 'do' | 'avoid') || 'do',
                goalId: (suggestion.data.goalId as string) || goals[0]?.id || null,
              });
            } else {
              modalHandlers.openGoalModal({
                name: (suggestion.data.name as string) || '',
                parentId: null,
              });
            }
        }

        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'accepted' },
        }));

      } else if (actionId === 'snooze') {
        // Save to snoozed suggestions for later
        const snoozedItem: SnoozedSuggestion = {
          id: `snoozed-${Date.now()}`,
          messageId,
          type: suggestion.type,
          data: suggestion.data,
          snoozedAt: new Date(),
        };

        setSnoozedSuggestions(prev => [...prev, snoozedItem]);

        // Add system message
        addMessage({
          id: `system-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: roleIcons.system,
          content: locale === 'ja'
            ? '⏭️ 提案を後で確認リストに追加しました'
            : '⏭️ Added suggestion to review later list',
          timestamp: new Date(),
        });

        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'snoozed' },
        }));

      } else if (actionId === 'dismiss') {
        // Just mark as dismissed
        setSuggestionStates(prev => ({
          ...prev,
          [messageId]: { status: 'dismissed' },
        }));

        // Add system message
        addMessage({
          id: `system-${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderType: 'system',
          senderIcon: roleIcons.system,
          content: locale === 'ja'
            ? '❌ 提案を非表示にしました'
            : '❌ Dismissed suggestion',
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to process suggestion action:', error);
      setSuggestionStates(prev => ({
        ...prev,
        [messageId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }));

      // Add error message
      addMessage({
        id: `error-${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderType: 'system',
        senderIcon: roleIcons.system,
        content: locale === 'ja'
          ? '❌ 提案の処理に失敗しました'
          : '❌ Failed to process suggestion',
        timestamp: new Date(),
      });
    }
  }, [locale, modalHandlers, addMessage, activeAgent, goals, roleIcons]);

  return {
    suggestionStates,
    snoozedSuggestions,
    handleSuggestionAction,
  };
}
