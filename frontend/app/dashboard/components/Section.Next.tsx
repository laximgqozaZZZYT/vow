import { formatTime24, formatDateTime24 } from '../../../lib/format';
import type { NextSectionProps, Habit } from '../types';

export default function NextSection({ habits, onHabitAction }: NextSectionProps) {
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
          <li key={c.h.id} className={`flex items-center justify-between py-2 ${idx > 0 ? 'mt-2 border-t border-zinc-100 pt-3' : ''}`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="w-16 shrink-0 text-xs text-zinc-500 tabular-nums">
                {(() => {
                  const d = c.start;
                  const todayStr = new Date().toISOString().slice(0,10);
                  if (d.toISOString().slice(0,10) === todayStr) return formatTime24(d, { hour: '2-digit', minute: '2-digit' });
                  return formatDateTime24(d);
                })()}
              </div>
              <div className="w-2 h-2 shrink-0 rounded-full bg-sky-500" />
              <div className={`truncate text-sm ${c.h.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{c.h.name}</div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  title="Start"
                  onClick={(e) => { e.stopPropagation(); onHabitAction(c.h.id, 'start') }}
                  className="rounded px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-white/10"
                >
                  ▶️
                </button>
                <button
                  title="Pause"
                  onClick={(e) => { e.stopPropagation(); onHabitAction(c.h.id, 'pause') }}
                  className="rounded px-2 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-white/10"
                >
                  ⏸️
                </button>
                <button
                  title="Done"
                  onClick={(e) => { e.stopPropagation(); onHabitAction(c.h.id, 'complete') }}
                  className="rounded px-2 py-1 text-green-600 hover:bg-green-50 dark:hover:bg-white/10"
                >
                  ✅
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}