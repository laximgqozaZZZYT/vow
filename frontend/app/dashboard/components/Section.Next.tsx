import { formatTime24, formatDateTime24 } from '../../../lib/format';
import type { NextSectionProps, Habit } from '../types';
import { useState } from 'react';

export default function NextSection({ habits, onHabitAction }: NextSectionProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates: Array<{ h: Habit; start: Date }> = [];

  for (const h of habits) {
    if (h.completed) continue;
    if (h.type === 'avoid') continue;
    const timings = (h as any).timings ?? [];
    let found: Date | null = null;

    // check explicit timings first
    if (timings && timings.length) {
      for (const t of timings) {
        try {
          if (t.start) {
            const baseDate = t.date ?? h.dueDate ?? now.toISOString().slice(0,10);
            const dt = new Date(`${baseDate}T${t.start}:00`);
            if (dt >= now && dt <= windowEnd) { found = dt; break }
            const dtNext = new Date(dt.getTime() + 24*60*60*1000);
            if (dtNext >= now && dtNext <= windowEnd) { found = dtNext; break }
          }
        } catch (e) { /* ignore malformed */ }
      }
    }

    // fallback: use h.time / dueDate
    if (!found && h.time) {
      try {
        const baseDate = h.dueDate ?? now.toISOString().slice(0,10);
        let dt = new Date(`${baseDate}T${h.time}:00`);
        if (dt < now) dt = new Date(dt.getTime() + 24*60*60*1000);
        if (dt >= now && dt <= windowEnd) found = dt;
      } catch (e) { /* ignore malformed */ }
    }

    if (found) candidates.push({ h, start: found });
  }

  candidates.sort((a,b) => a.start.getTime() - b.start.getTime());
  const pick = candidates.slice(0,5);

  const getInputValue = (habitId: string) => {
    if (inputValues[habitId] !== undefined) {
      return inputValues[habitId];
    }
    const habit = habits.find(h => h.id === habitId);
    const workloadPerCount = (habit as any)?.workloadPerCount ?? 1;
    return String(workloadPerCount);
  };

  const setInputValue = (habitId: string, value: string) => {
    setInputValues(prev => ({ ...prev, [habitId]: value }));
  };

  const handleCompleteWithAmount = (habitId: string) => {
    const amount = parseFloat(getInputValue(habitId)) || 1;
    onHabitAction(habitId, 'complete', amount);
  };

  if (pick.length === 0) {
    return (
      <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
        <div className="flex justify-between items-start">
          <h2 className="mb-3 text-lg font-medium">Next</h2>
        </div>
        <div className="text-sm text-zinc-500">No habits starting in the next 24 hours</div>
      </section>
    );
  }

  return (
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <div className="flex justify-between items-start">
        <h2 className="mb-3 text-lg font-medium">Next</h2>
      </div>
      <ul className="flex flex-col">
        {pick.map((c, idx) => (
          <li key={c.h.id} className={`flex items-center justify-between py-2 ${idx > 0 ? 'mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-3' : ''}`}>
            <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-1">
              <div className="w-12 sm:w-16 shrink-0 text-xs text-zinc-500 tabular-nums">
                {(() => {
                  const d = c.start;
                  const todayStr = new Date().toISOString().slice(0,10);
                  if (d.toISOString().slice(0,10) === todayStr) return formatTime24(d, { hour: '2-digit', minute: '2-digit' });
                  return formatDateTime24(d);
                })()}
              </div>
              <div className="w-2 h-2 shrink-0 rounded-full bg-sky-500" />
              <div className="flex-1 min-w-0">
                <div className={`truncate text-sm ${c.h.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>
                  {c.h.name}
                </div>
                {(c.h as any)?.workloadUnit && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Target: {(c.h as any)?.workloadPerCount || 1} {(c.h as any)?.workloadUnit}
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={getInputValue(c.h.id)}
                onChange={(e) => setInputValue(c.h.id, e.target.value)}
                className="w-12 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-0 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="text-xs text-zinc-500">
                {(c.h as any)?.workloadUnit || 'units'}
              </span>
              <button
                title="Complete"
                onClick={(e) => { e.stopPropagation(); handleCompleteWithAmount(c.h.id) }}
                className="bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1 text-xs font-medium transition-colors"
              >
                ✓
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}