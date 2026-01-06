import { formatDateTime24 } from '../../../lib/format';
import type { ActivitySectionProps } from '../types';

export default function ActivitySection({ activities, onEditActivity, onDeleteActivity }: ActivitySectionProps) {
  return (
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b] mt-4">
      <h2 className="mb-3 text-lg font-medium">Activity</h2>
      <div className="">
        {/* Fixed-height scrollable container */}
        <div className="h-56 overflow-y-auto space-y-2 pr-2">
          {activities.length === 0 && <div className="text-xs text-zinc-500">No activity yet.</div>}
          {[...activities].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(act => (
            <div key={act.id} className="flex items-center justify-between rounded px-2 py-2 hover:bg-zinc-100 dark:hover:bg-white/5">
              <div className="text-sm">
                <div className="text-xs text-zinc-500">{formatDateTime24(new Date(act.timestamp))}</div>
                {act.kind === 'start' && (
                  <div>{act.habitName} — started</div>
                )}
                {act.kind === 'pause' && (
                  <div>{act.habitName} — paused at {act.amount ?? 0} load</div>
                )}
                {act.kind === 'complete' && (
                  <div>
                    {act.habitName} — completed {act.amount ?? 1} {((act.amount ?? 1) > 1) ? 'units' : 'unit'}.
                    {typeof act.durationSeconds === 'number' ? ` Took ${Math.floor(act.durationSeconds/3600)}h ${Math.floor((act.durationSeconds%3600)/60)}m ${act.durationSeconds%60}s.` : ''}
                    {act.newCount !== undefined ? ` (now ${act.newCount})` : ''}
                  </div>
                )}
                {act.kind === 'skip' && (
                  <div>{act.habitName} — skipped</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button className="text-sm text-blue-600" onClick={() => onEditActivity(act.id)}>Edit</button>
                <button className="text-sm text-red-600" onClick={() => onDeleteActivity(act.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}