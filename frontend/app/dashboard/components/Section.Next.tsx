import { formatTime24, formatDateTime24 } from '../../../lib/format';
import type { NextSectionProps, Habit } from '../types';
import { useState } from 'react';
import './HabitNameScroll.css';
import { useHandedness } from '../contexts/HandednessContext';
import { isHabitCumulativelyCompleted } from '../utils/habitCompletionUtils';

export default function NextSection({ habits, activities, onHabitAction, onHabitEdit }: NextSectionProps) {
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { isLeftHanded } = useHandedness();
  
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const candidates: Array<{ h: Habit; start: Date }> = [];

  for (const h of habits) {
    if (h.completed) continue;
    if (h.type === 'avoid') continue;
    
    // 累積完了チェック: Requirements 4.1
    if (isHabitCumulativelyCompleted(h, activities)) continue;
    
    const timings = (h as any).timings ?? [];
    let found: Date | null = null;

    // check explicit timings first
    if (timings && timings.length) {
      for (const t of timings) {
        try {
          if (t.start) {
            const baseDate = t.date ?? h.dueDate ?? now.toISOString().slice(0,10);
            let dt = new Date(`${baseDate}T${t.start}:00`);
            
            // If the datetime is in the past, shift to today or tomorrow
            if (dt < now) {
              const todayStr = now.toISOString().slice(0,10);
              dt = new Date(`${todayStr}T${t.start}:00`);
              
              // If still in the past (earlier today), try tomorrow
              if (dt < now) {
                dt = new Date(dt.getTime() + 24*60*60*1000);
              }
            }
            
            if (dt >= now && dt <= windowEnd) { found = dt; break }
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
      <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6">
        <div className={`flex items-start ${isLeftHanded ? 'justify-end' : 'justify-between'}`}>
          <h2 className="mb-3 text-lg font-semibold">Next</h2>
        </div>
        <div className="text-sm text-muted-foreground">No habits starting in the next 24 hours</div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-4 sm:p-6">
      <div className={`flex items-start ${isLeftHanded ? 'justify-end' : 'justify-between'}`}>
        <h2 className="mb-3 text-lg font-semibold">Next</h2>
      </div>
      <ul className="flex flex-col">
        {pick.map((c, idx) => (
          <li key={c.h.id} className={`flex items-center gap-2 sm:gap-3 py-2.5 sm:py-2 ${isLeftHanded ? 'flex-row-reverse' : ''} ${idx > 0 ? 'mt-2 border-t border-zinc-100 dark:border-zinc-800 pt-3' : ''}`}>
            <div className={`flex shrink-0 items-center gap-1.5 sm:gap-2 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <button
                title="Complete"
                onClick={(e) => { e.stopPropagation(); handleCompleteWithAmount(c.h.id) }}
                className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded px-2 py-1 text-xs font-medium transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                ✓
              </button>
              <span className={`text-xs text-zinc-500 hidden sm:inline w-16 truncate ${isLeftHanded ? 'text-right' : 'text-left'}`} title={(c.h as any)?.workloadUnit || 'units'}>
                {(c.h as any)?.workloadUnit || 'units'}
              </span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={getInputValue(c.h.id)}
                onChange={(e) => setInputValue(c.h.id, e.target.value)}
                className="w-10 sm:w-12 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-0 rounded px-1 sm:px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className={`flex min-w-0 items-center gap-2 sm:gap-3 flex-1 ${isLeftHanded ? 'flex-row-reverse' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="habit-name-scroll min-w-0 overflow-hidden">
                  <button
                    onClick={(e) => { e.stopPropagation(); onHabitEdit(c.h.id); }}
                    className={`habit-name-text inline-block whitespace-nowrap text-sm text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer ${c.h.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}
                  >
                    {c.h.name}
                  </button>
                </div>
                {(c.h as any)?.workloadUnit && (
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">
                    Target: {(c.h as any)?.workloadPerCount || 1} {(c.h as any)?.workloadUnit}
                  </div>
                )}
              </div>
              <div className="w-2 h-2 shrink-0 rounded-full bg-sky-500" />
              <div className="w-12 sm:w-16 shrink-0 text-xs text-zinc-500 tabular-nums">
                {(() => {
                  const d = c.start;
                  const todayStr = new Date().toISOString().slice(0,10);
                  if (d.toISOString().slice(0,10) === todayStr) return formatTime24(d, { hour: '2-digit', minute: '2-digit' });
                  return formatDateTime24(d);
                })()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}