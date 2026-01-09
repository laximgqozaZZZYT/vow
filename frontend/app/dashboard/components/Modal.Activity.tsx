"use client";

import React, { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type ActivityKind = 'start' | 'complete' | 'skip' | 'pause';
export type Activity = { id: string; kind: ActivityKind; habitId: string; habitName: string; timestamp: string; amount?: number; prevCount?: number; newCount?: number; durationSeconds?: number; memo?: string }

export default function ActivityModal({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial?: Activity | null; onSave: (updated: Activity) => void }) {
  const [amount, setAmount] = useState<string>(String(initial?.amount ?? 0));
  const [memo, setMemo] = useState<string>(initial?.memo ?? '');
  const [hours, setHours] = useState<string>(String(initial?.durationSeconds ? Math.floor(initial.durationSeconds/3600) : 0));
  const [minutes, setMinutes] = useState<string>(String(initial?.durationSeconds ? Math.floor((initial.durationSeconds%3600)/60) : 0));
  const [seconds, setSeconds] = useState<string>(String(initial?.durationSeconds ? (initial.durationSeconds%60) : 0));
  const [kind, setKind] = useState<ActivityKind>(initial?.kind ?? 'complete');
  const [errors, setErrors] = useState<{ amount?: string; duration?: string; memo?: string }>({});
  const amountRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setAmount(String(initial?.amount ?? 0));
    setMemo(initial?.memo ?? '');
    setHours(String(initial?.durationSeconds ? Math.floor(initial.durationSeconds/3600) : 0));
    setMinutes(String(initial?.durationSeconds ? Math.floor((initial.durationSeconds%3600)/60) : 0));
    setSeconds(String(initial?.durationSeconds ? (initial.durationSeconds%60) : 0));
    setKind(initial?.kind ?? 'complete');
  }, [initial]);

  useEffect(() => {
    if (open) {
      // autofocus amount
      setTimeout(() => amountRef.current?.focus(), 50);
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [open, onClose]);

  useEffect(() => {
    const errs: { amount?: string; duration?: string; memo?: string } = {};
    const amountNum = Number(amount);
    const hoursNum = Number(hours);
    const minutesNum = Number(minutes);
    const secondsNum = Number(seconds);
    
    if (Number.isNaN(amountNum) || amountNum < 0) errs.amount = 'Load must be 0 or greater';
    if (hoursNum < 0 || minutesNum < 0 || secondsNum < 0) errs.duration = 'Duration values must be 0 or greater';
    if (minutesNum >= 60 || secondsNum >= 60) errs.duration = 'Minutes/seconds must be less than 60';
    if (memo.length > 500) errs.memo = 'Memo must be under 500 characters';
    setErrors(errs);
  }, [amount, hours, minutes, seconds, memo]);

  if (!open) return null;

  function handleSave() {
    if (Object.keys(errors).length) return;
    const hoursNum = Number(hours) || 0;
    const minutesNum = Number(minutes) || 0;
    const secondsNum = Number(seconds) || 0;
    const durationSeconds = Math.max(0, Math.floor(hoursNum*3600 + minutesNum*60 + secondsNum));
    const amountNum = Number(amount) || 0;
    
    const updated: Activity = {
      id: initial?.id ?? `a${Date.now()}`,
      kind,
      habitId: initial?.habitId ?? '',
      habitName: initial?.habitName ?? '',
      timestamp: initial?.timestamp ?? new Date().toISOString(),
      amount: amountNum,
      prevCount: initial?.prevCount,
      newCount: initial?.newCount,
      durationSeconds,
      memo
    };
    onSave(updated);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-full max-w-lg rounded bg-white px-4 pt-4 pb-0 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">Activity</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <div className="mt-4 flex gap-4 habit-scroll-area overflow-auto max-h-[65vh] pr-2 modal-scroll-gap">
          <div className="flex-1">
            <div className="space-y-3">
              <label className="block text-xs text-slate-400">Status</label>
              <select className="w-full rounded border px-2 py-1 bg-white text-black dark:bg-slate-800 dark:text-slate-100" value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)}>
                <option value="start">Start</option>
                <option value="pause">Pause</option>
                <option value="complete">Done</option>
                <option value="skip">Skip</option>
              </select>

              <label className="block text-xs text-slate-400">Load</label>
              <input ref={amountRef} className="w-full rounded border px-2 py-1 text-sm bg-white text-black dark:bg-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
              {errors.amount && <div className="text-xs text-red-600">{errors.amount}</div>}

              <label className="block text-xs text-slate-400">Memo</label>
              <textarea className="w-full rounded border px-2 py-1 text-sm bg-white text-black dark:bg-slate-800 dark:text-slate-100" rows={3} value={memo} onChange={(e) => setMemo(e.target.value)} />
              {errors.memo && <div className="text-xs text-red-600">{errors.memo}</div>}

              <div>
                <div className="text-xs text-slate-400">Duration (h / m / s)</div>
                <div className="flex gap-2 mt-1">
                  <input className="w-20 rounded border px-2 py-1 text-sm bg-white text-black dark:bg-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
                  <input className="w-20 rounded border px-2 py-1 text-sm bg-white text-black dark:bg-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                  <input className="w-20 rounded border px-2 py-1 text-sm bg-white text-black dark:bg-slate-800 dark:text-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                </div>
                {errors.duration && <div className="text-xs text-red-600">{errors.duration}</div>}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button className={`rounded bg-sky-600 px-3 py-2 text-white ${Object.keys(errors).length ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleSave} disabled={Object.keys(errors).length > 0}>Save</button>
                <button className="rounded border px-3 py-2" onClick={onClose}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
