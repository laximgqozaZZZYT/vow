/**
 * useConversationMemory - Conversation context state management hook
 *
 * Manages conversation flow state and memory for MOC chat improvement.
 * Tracks user selections, previous suggestions, and flow progression.
 *
 * @module useConversationMemory
 */

import { useState, useCallback } from 'react';
import type { InfoTypeSelection, FlowStep } from '../config/questionFlowConfig';

/** Category selection options for conversation flow */
export type CategorySelection =
  | 'health'
  | 'career'
  | 'learning'
  | 'hobby'
  | 'relationships'
  | 'finance'
  | 'lifestyle'
  | 'other';

/** Conversation context state */
export interface ConversationContext {
  /** Current step in the question flow */
  currentStep: FlowStep;

  /** User's selection for information type (Step 1) */
  infoType?: InfoTypeSelection;

  /** User's category selection (Step 2) */
  category?: CategorySelection;

  /** User's sub-category selection (Step 3) */
  subCategory?: string;

  /** Previously shown suggestions (for exclusion, max 20) */
  previousSuggestions: string[];

  /** Timestamp of last interaction */
  lastInteraction: Date;
}

/** Hook return type */
export interface UseConversationMemoryReturn {
  /** Current conversation context */
  context: ConversationContext;

  /** Set information type and progress to next step */
  setInfoType: (type: InfoTypeSelection) => void;

  /** Set category and progress to next step */
  setCategory: (category: CategorySelection) => void;

  /** Set sub-category and progress to generating step */
  setSubCategory: (subCategory: string) => void;

  /** Add a suggestion to the previous suggestions list */
  addPreviousSuggestion: (name: string) => void;

  /** Reset conversation context to initial state */
  reset: () => void;
}

/**
 * Determine the next step based on selected info type
 *
 * @param type - Selected information type
 * @returns Next flow step
 */
function getNextStep(type: InfoTypeSelection): FlowStep {
  switch (type) {
    case 'review_habits':
      return 'idle'; // Show existing habits directly
    case 'habits_for_goal':
      return 'idle'; // Show existing goals, then suggest habits
    case 'new_goal':
      return 'category'; // Ask for category
    case 'new_habit':
      return 'category'; // Ask for category
    case 'check_registered':
      return 'idle'; // Show summary directly
    case 'other_advice':
      return 'idle'; // Free-form conversation
    default:
      return 'idle';
  }
}

/**
 * Hook for managing conversation memory and flow state
 *
 * @returns Conversation context and control functions
 */
export function useConversationMemory(): UseConversationMemoryReturn {
  const [context, setContext] = useState<ConversationContext>({
    currentStep: 'idle',
    previousSuggestions: [],
    lastInteraction: new Date(),
  });

  const setInfoType = useCallback((type: InfoTypeSelection) => {
    setContext(prev => ({
      ...prev,
      infoType: type,
      currentStep: getNextStep(type),
      lastInteraction: new Date(),
    }));
  }, []);

  const setCategory = useCallback((category: CategorySelection) => {
    setContext(prev => ({
      ...prev,
      category,
      currentStep: 'subcategory',
      lastInteraction: new Date(),
    }));
  }, []);

  const setSubCategory = useCallback((subCategory: string) => {
    setContext(prev => ({
      ...prev,
      subCategory,
      currentStep: 'generating',
      lastInteraction: new Date(),
    }));
  }, []);

  const addPreviousSuggestion = useCallback((name: string) => {
    setContext(prev => ({
      ...prev,
      previousSuggestions: [...prev.previousSuggestions, name].slice(-20), // Keep last 20
    }));
  }, []);

  const reset = useCallback(() => {
    setContext({
      currentStep: 'idle',
      previousSuggestions: [],
      lastInteraction: new Date(),
    });
  }, []);

  return {
    context,
    setInfoType,
    setCategory,
    setSubCategory,
    addPreviousSuggestion,
    reset,
  };
}
