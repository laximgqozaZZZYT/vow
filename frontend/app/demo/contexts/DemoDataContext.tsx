'use client';

/**
 * Demo Data Provider Context
 *
 * Provides demo data and mock handlers for the landing page demo section.
 * This context ensures NO API calls are made during rendering (Requirement 3.6)
 * and passes demo data instead of API-fetched data (Requirement 3.5).
 *
 * Requirements: 3.5, 3.6
 */

import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Habit, Goal, Activity, Sticky, HabitAction } from '@/app/dashboard/types';
import { demoGoals, demoHabits, demoActivities, demoStickies } from '../data/demoData';

// ============================================================================
// Types
// ============================================================================

/**
 * Animation state for the demo section
 */
export interface DemoAnimationState {
  currentStep: number;
  isPlaying: boolean;
  isPaused: boolean;
  highlightedElement: string | null;
  cursorPosition: { x: number; y: number } | null;
}

/**
 * Context value interface for demo data provider
 */
export interface DemoDataContextValue {
  // Data
  habits: Habit[];
  goals: Goal[];
  activities: Activity[];
  stickies: Sticky[];
  // Animation state
  animationState: DemoAnimationState;
  // Handlers (mock implementations for demo)
  onHabitAction: (habitId: string, action: HabitAction, amount?: number) => void;
  onStickyCreate: () => void;
  onStickyComplete: (stickyId: string) => void;
  // Animation state setters
  setAnimationState: React.Dispatch<React.SetStateAction<DemoAnimationState>>;
  // Reset function
  resetDemoData: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialAnimationState: DemoAnimationState = {
  currentStep: 0,
  isPlaying: false,
  isPaused: false,
  highlightedElement: null,
  cursorPosition: null,
};

// ============================================================================
// Context
// ============================================================================

const DemoDataContext = createContext<DemoDataContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface DemoDataProviderProps {
  children: ReactNode;
  /** Optional initial animation state override */
  initialState?: Partial<DemoAnimationState>;
}

/**
 * DemoDataProvider
 *
 * Provides demo data and mock handlers to child components.
 * All data is static and no API calls are made.
 */
export function DemoDataProvider({ children, initialState }: DemoDataProviderProps) {
  // State for demo data (can be modified by mock handlers)
  const [habits, setHabits] = useState<Habit[]>(() => [...demoHabits]);
  const [goals] = useState<Goal[]>(() => [...demoGoals]);
  const [activities, setActivities] = useState<Activity[]>(() => [...demoActivities]);
  const [stickies, setStickies] = useState<Sticky[]>(() => [...demoStickies]);

  // Animation state
  const [animationState, setAnimationState] = useState<DemoAnimationState>(() => ({
    ...initialAnimationState,
    ...initialState,
  }));

  /**
   * Mock handler for habit actions (start, complete, pause)
   * Updates local state to simulate the action without API calls
   */
  const onHabitAction = useCallback((habitId: string, action: HabitAction, amount?: number) => {
    setHabits((prevHabits) =>
      prevHabits.map((habit) => {
        if (habit.id !== habitId) return habit;

        switch (action) {
          case 'start':
            return { ...habit, count: 0, completed: false };
          case 'complete': {
            const newCount = amount ?? habit.must;
            return {
              ...habit,
              count: newCount,
              completed: newCount >= habit.must,
              lastCompletedAt: new Date().toISOString(),
            };
          }
          case 'pause':
            return habit; // Pause doesn't change habit state in demo
          default:
            return habit;
        }
      })
    );

    // Add activity record for the action
    const habit = habits.find((h) => h.id === habitId);
    if (habit) {
      const newActivity: Activity = {
        id: `demo-activity-${Date.now()}`,
        kind: action === 'start' ? 'start' : action === 'complete' ? 'complete' : 'pause',
        habitId,
        habitName: habit.name,
        timestamp: new Date().toISOString(),
        amount: action === 'complete' ? (amount ?? habit.must) : undefined,
        prevCount: habit.count,
        newCount: action === 'complete' ? (amount ?? habit.must) : habit.count,
      };
      setActivities((prev) => [newActivity, ...prev]);
    }
  }, [habits]);

  /**
   * Mock handler for creating a new sticky
   * Creates a new sticky with default values
   */
  const onStickyCreate = useCallback(() => {
    const newSticky: Sticky = {
      id: `demo-sticky-${Date.now()}`,
      name: '新しいメモ',
      description: '',
      completed: false,
      displayOrder: stickies.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setStickies((prev) => [...prev, newSticky]);
  }, [stickies.length]);

  /**
   * Mock handler for completing a sticky
   * Toggles the completed state of the sticky
   */
  const onStickyComplete = useCallback((stickyId: string) => {
    setStickies((prevStickies) =>
      prevStickies.map((sticky) => {
        if (sticky.id !== stickyId) return sticky;
        return {
          ...sticky,
          completed: !sticky.completed,
          completedAt: !sticky.completed ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, []);

  /**
   * Reset all demo data to initial state
   */
  const resetDemoData = useCallback(() => {
    setHabits([...demoHabits]);
    setActivities([...demoActivities]);
    setStickies([...demoStickies]);
    setAnimationState({ ...initialAnimationState, ...initialState });
  }, [initialState]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<DemoDataContextValue>(
    () => ({
      habits,
      goals,
      activities,
      stickies,
      animationState,
      onHabitAction,
      onStickyCreate,
      onStickyComplete,
      setAnimationState,
      resetDemoData,
    }),
    [
      habits,
      goals,
      activities,
      stickies,
      animationState,
      onHabitAction,
      onStickyCreate,
      onStickyComplete,
      resetDemoData,
    ]
  );

  return (
    <DemoDataContext.Provider value={contextValue}>
      {children}
    </DemoDataContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useDemoData hook
 *
 * Provides access to demo data and handlers within the DemoDataProvider context.
 * Throws an error if used outside of the provider.
 */
export function useDemoData(): DemoDataContextValue {
  const context = useContext(DemoDataContext);
  if (!context) {
    throw new Error('useDemoData must be used within a DemoDataProvider');
  }
  return context;
}

/**
 * useDemoDataOptional hook
 *
 * Provides access to demo data and handlers, returning null if outside provider.
 * Useful for components that may or may not be within the demo context.
 */
export function useDemoDataOptional(): DemoDataContextValue | null {
  return useContext(DemoDataContext);
}

// ============================================================================
// Exports
// ============================================================================

export { DemoDataContext };
export type { DemoDataProviderProps };
