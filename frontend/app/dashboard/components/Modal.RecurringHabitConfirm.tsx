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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
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
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            すべての繰り返しを変更
            <div className="text-xs opacity-80 mt-1">
              今後のすべての繰り返しタスクの時間を変更します
            </div>
          </button>
          
          <button
            onClick={() => onConfirm('createException')}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            この日のみ変更
            <div className="text-xs opacity-80 mt-1">
              {date}のみ時間を変更し、他の日は元の時間のままにします
            </div>
          </button>
          
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}