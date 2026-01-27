"use client";

/**
 * Widget.HabitInventory Component
 * 
 * Main widget for habit inventory feature.
 * Includes the "すべての習慣を評価" button and manages the inventory flow.
 * 
 * @module Widget.HabitInventory
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import React, { useState, useCallback, useEffect } from 'react';
import InventoryConfirmModal from './Modal.InventoryConfirm';
import InventorySummaryModal from './Modal.InventorySummary';
import InventoryProgress from './Widget.InventoryProgress';
import { useHabitInventory } from '../../../hooks/useHabitInventory';
import type { InventorySummaryData } from './Modal.InventorySummary';

export interface HabitInventoryWidgetProps {
  /** API base URL */
  apiBaseUrl?: string;
  /** Callback when inventory completes */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Widget.HabitInventory component
 */
export default function HabitInventoryWidget({
  apiBaseUrl = '/api',
  onComplete,
  className = '',
}: HabitInventoryWidgetProps) {
  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState<InventorySummaryData | null>(null);

  // Use the inventory hook
  const {
    state,
    quotaStatus,
    loading,
    fetchUnassessedHabits,
    startInventory,
    cancelInventory,
    getSummary,
    reset,
  } = useHabitInventory({
    apiBaseUrl,
    onComplete: (summary) => {
      setSummaryData(summary);
      setShowSummaryModal(true);
      onComplete?.();
    },
    onError: (error) => {
      console.error('Inventory error:', error);
    },
  });

  // Fetch unassessed habits when confirm modal opens
  useEffect(() => {
    if (showConfirmModal) {
      fetchUnassessedHabits();
    }
  }, [showConfirmModal, fetchUnassessedHabits]);

  // Handle button click
  const handleButtonClick = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback((selectedHabitIds?: string[]) => {
    setShowConfirmModal(false);
    startInventory(selectedHabitIds);
  }, [startInventory]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    cancelInventory();
    const summary = getSummary();
    if (summary && (summary.totalAssessed > 0 || summary.pendingData > 0)) {
      setSummaryData(summary);
      setShowSummaryModal(true);
    }
  }, [cancelInventory, getSummary]);

  // Handle summary modal close
  const handleSummaryClose = useCallback(() => {
    setShowSummaryModal(false);
    reset();
  }, [reset]);

  // Don't show button if inventory is running
  const showButton = !state.isRunning;

  return (
    <div className={className}>
      {/* Main Button */}
      {showButton && (
        <button
          onClick={handleButtonClick}
          disabled={loading}
          className="
            w-full px-4 py-3
            bg-card border border-border
            rounded-lg shadow-sm
            hover:bg-muted/50
            focus-visible:outline-2 focus-visible:outline-primary
            transition-colors
            flex items-center justify-center gap-3
            disabled:opacity-50
          "
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-medium">すべての習慣を評価</div>
            <div className="text-xs text-muted-foreground">
              未評価の習慣を一括でレベル評価します
            </div>
          </div>
          <svg className="w-5 h-5 text-muted-foreground ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Progress Indicator */}
      {state.isRunning && (
        <InventoryProgress
          current={state.completedCount}
          total={state.totalCount}
          currentHabitName={state.currentHabit?.name}
          isRunning={state.isRunning}
          onCancel={handleCancel}
          pendingDataCount={state.pendingDataCount}
        />
      )}

      {/* Confirmation Modal */}
      <InventoryConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        unassessedCount={state.totalCount}
        quotaStatus={quotaStatus}
        habits={state.habits}
        loading={loading}
      />

      {/* Summary Modal */}
      <InventorySummaryModal
        isOpen={showSummaryModal}
        onClose={handleSummaryClose}
        summary={summaryData}
        loading={false}
      />
    </div>
  );
}

/**
 * Compact button version for use in headers/toolbars
 */
export function HabitInventoryButton({
  onClick,
  disabled = false,
  className = '',
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        px-3 py-2
        bg-primary text-primary-foreground
        rounded-md shadow-sm
        hover:opacity-90
        focus-visible:outline-2 focus-visible:outline-primary
        transition-opacity
        flex items-center gap-2
        disabled:opacity-50
        ${className}
      `}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <span className="text-sm font-medium">すべての習慣を評価</span>
    </button>
  );
}
