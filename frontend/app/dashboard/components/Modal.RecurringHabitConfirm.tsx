"use client";

import { useState } from 'react';

interface RecurringHabitConfirmModalProps {
  open: boolean;
  habitName: string;
  originalTime: string;
  newTime: string;
  date: string;
  onConfirm: (action: 'updateTiming' | 'createException') => void;
  onCancel: () => void;
}

export default function RecurringHabitConfirmModal({
  open,
  habitName,
  originalTime,
  newTime,
  date,
  onConfirm,
  onCancel
}: RecurringHabitConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border shadow-lg">
        <h3 className="text-lg font-semibold mb-4 text-card-foreground">
          繰り返しタスクの時間変更
        </h3>
        
        <div className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          <p className="mb-2">
            <strong>タスク:</strong> {habitName}
          </p>
          <p className="mb-2">
            <strong>日付:</strong> {date}
          </p>
          <p className="mb-2">
            <strong>時間変更:</strong> {originalTime} → {newTime}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            このタスクは繰り返し設定されています。どのように変更しますか？
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirm('updateTiming')}
            className="inline-flex flex-col items-start justify-center w-full rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            すべての繰り返しを変更
            <div className="text-xs opacity-80 mt-1">
              今後のすべての繰り返しタスクの時間を変更します
            </div>
          </button>
          
          <button
            onClick={() => onConfirm('createException')}
            className="inline-flex flex-col items-start justify-center w-full rounded-md bg-success text-success-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
          >
            この日のみ変更
            <div className="text-xs opacity-80 mt-1">
              {date}のみ時間を変更し、他の日は元の時間のままにします
            </div>
          </button>
          
          <button
            onClick={onCancel}
            className="inline-flex items-center justify-center w-full rounded-md bg-secondary text-secondary-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}