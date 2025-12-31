"use client";

import { useState, useMemo } from "react";
import { NewCategoryModal, NewHabitModal, HabitModal } from "./components/modals";
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
// FullCalendar CSS imports removed to avoid module resolution errors in this environment.
// If you want FullCalendar's default styles, consider adding them via a global CSS import
// or linking the CSS from a CDN in _document or app root.

type Category = { id: string; name: string; details?: string; dueDate?: string; createdAt: string; updatedAt: string };
type Habit = { id: string; categoryId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; completed?: boolean; lastCompletedAt?: string; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; createdAt: string; updatedAt: string };

export default function DashboardPage() {
  const now = new Date().toISOString();
  const [categories, setCategories] = useState<Category[]>([
    { id: "c1", name: "仕事", createdAt: now, updatedAt: now },
    { id: "c2", name: "パーソナル", createdAt: now, updatedAt: now },
  ]);
  const [habits, setHabits] = useState<Habit[]>([
  { id: "h1", categoryId: "c1", name: "メール確認", active: true, type: "do", count: 8, completed: false, createdAt: now, updatedAt: now },
  { id: "h2", categoryId: "c1", name: "タスクレビュー", active: false, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
  { id: "h3", categoryId: "c2", name: "早起き", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categories[0]?.id ?? null
  );
  const [showLeftPane, setShowLeftPane] = useState(false);

  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openNewHabit, setOpenNewHabit] = useState(false);
  const [openHabitModal, setOpenHabitModal] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  function createCategory(payload: { name: string; details?: string; dueDate?: string }) {
    const id = `c${Date.now()}`;
    const now = new Date().toISOString();
    setCategories((s) => [
      ...s,
      { id, name: payload.name, details: payload.details, dueDate: payload.dueDate, createdAt: now, updatedAt: now },
    ]);
    setSelectedCategory(id);
  }

  function createHabit(payload: { name: string; categoryId: string; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; policy?: "Schedule" | "Count"; targetCount?: number }) {
    const id = `h${Date.now()}`;
    const now = new Date().toISOString();
    setHabits((s) => [
      ...s,
      { id, categoryId: payload.categoryId, name: payload.name, active: true, type: payload.type, count: 0, must: payload.targetCount ?? undefined, policy: payload.policy ?? 'Schedule', targetCount: payload.targetCount ?? undefined, completed: false, duration: payload.duration, reminders: payload.reminders, dueDate: payload.dueDate, time: payload.time, endTime: payload.endTime, repeat: payload.repeat, allDay: payload.allDay, notes: payload.notes, createdAt: now, updatedAt: now },
    ]);
  }

  // derived when needed

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  function toggleCategory(id: string) {
    setOpenCategories((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black text-black dark:text-zinc-50">
      {/* Top-left hamburger + label (styled to match sidebar) */}
      <div className="fixed left-3 top-3 z-50 flex items-center gap-3 rounded bg-white text-black dark:bg-[#071013] dark:text-white px-3 py-2 shadow-md dark:border-slate-700">
        <button onClick={() => setShowLeftPane((s) => !s)} aria-label="Toggle menu" className="px-3 py-2 text-lg leading-none">
          ☰
        </button>
        <div className="text-base font-bold">VOW</div>
      </div>

      {/* Left pane */}
      {showLeftPane && (
        <aside className="w-80 border-r border-zinc-200 bg-white dark:bg-[#071013] p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowLeftPane((s) => !s)} aria-label="Toggle menu" className="px-3 py-2 text-2xl leading-none">
                ☰
              </button>
              <div className="text-lg font-bold">VOW</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowLeftPane(false)} className="text-sm text-zinc-500">✕</button>
            </div>
          </div>

        <nav className="space-y-2">
          {categories.map((c) => {
            const isOpen = !!openCategories[c.id];
            return (
              <div key={c.id}>
                <div
                  className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 ${selectedCategory === c.id ? 'bg-zinc-100 dark:bg-white/5' : ''}`}
                  onClick={() => {
                    toggleCategory(c.id);
                    setSelectedCategory(c.id);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-3 ${isOpen ? '' : ''}`}>{isOpen ? '▾' : '▸'}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500">{habits.filter(h => h.categoryId === c.id).length}</div>
                </div>
                {isOpen && (
                  <div className="ml-6 mt-1 flex flex-col gap-1">
                    {habits.filter(h => h.categoryId === c.id).map(h => (
                      <div
                        key={h.id}
                        onClick={() => { setSelectedCategory(c.id); setSelectedHabitId(h.id); setOpenHabitModal(true); }}
                        className="flex items-center justify-between rounded px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>📄</span>
                          <span className={`truncate ${h.completed ? 'line-through text-zinc-400' : ''}`}>{h.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Complete */}
                          <button
                            title="Complete"
                            onClick={(e) => {
                              e.stopPropagation();
                              const now = new Date().toISOString();
                              setHabits((s) => s.map(x => {
                                if (x.id !== h.id) return x;
                                // Determine policy: prefer explicit x.policy, fallback to schedule behavior
                                const policy = (x as any).policy ?? 'Schedule';
                                if (policy === 'Count') {
                                  const prev = x.count ?? 0;
                                  const newCount = prev + 1;
                                  const must = x.must ?? (x as any).targetCount ?? 0;
                                  // If target is set and we've reached or exceeded it, mark completed
                                  if (must > 0 && newCount >= must) {
                                    return { ...x, count: newCount, completed: true, lastCompletedAt: now, updatedAt: now };
                                  }
                                  // Otherwise just increment the count
                                  return { ...x, count: newCount, lastCompletedAt: now, updatedAt: now };
                                } else {
                                  // Schedule: mark completed immediately
                                  return { ...x, completed: true, lastCompletedAt: now, updatedAt: now };
                                }
                              }));
                            }}
                            className="text-green-600 hover:bg-green-50 rounded px-2 py-1"
                          >
                            ✅
                          </button>
                        
                        </div>
                      </div>
                    ))}
                    {habits.filter(h => h.categoryId === c.id).length === 0 && (
                      <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto flex gap-2 pt-4">
          <button
            className="flex-1 rounded border px-3 py-2 text-sm"
            onClick={() => setOpenNewCategory(true)}
          >
            + New Category
          </button>
          <button
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => setOpenNewHabit(true)}
          >
            + New Habit
          </button>
        </div>
  </aside>
  )}

  {/* Right pane */}
      <main className="flex-1 p-8">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">Today</div>
            <div className="mt-2 text-2xl font-bold">3 / 5</div>
            <div className="mt-1 text-sm text-zinc-500">Completed habits</div>
          </div>
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">Streak</div>
            <div className="mt-2 text-2xl font-bold">12</div>
            <div className="mt-1 text-sm text-zinc-500">days</div>
          </div>
          <div className="col-span-1 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
            <div className="text-sm text-zinc-500">This week</div>
            <div className="mt-2 text-2xl font-bold">7</div>
            <div className="mt-1 text-sm text-zinc-500">completed</div>
          </div>
        </div>

  <FullCalendarWrapper habits={habits} />

        <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
          <h2 className="mb-3 text-lg font-medium">Recent Activity</h2>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600">
            <li>早起き — completed</li>
            <li>メール確認 — skipped</li>
            <li>タスクレビュー — completed</li>
          </ul>
        </section>
      </main>

      <NewCategoryModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        onCreate={(payload) => createCategory(payload)}
      />

      <NewHabitModal
        open={openNewHabit}
        onClose={() => setOpenNewHabit(false)}
        onCreate={(payload) => createHabit(payload)}
        categories={categories}
      />
      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit}
        onUpdate={(updated) => setHabits((s) => s.map(h => h.id === updated.id ? updated : h))}
        onDelete={(id) => setHabits((s) => s.filter(h => h.id !== id))}
        categories={categories}
      />
    </div>
  );
}

function FullCalendarWrapper({ habits }: { habits: Habit[] }) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0,0,0,0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)

  const events = useMemo(() => {
    const ev: any[] = []
    for (const h of (habits ?? [])) {
      const policy = (h as any).policy ?? 'Schedule'
      if (policy === 'Count') {
        // all-day event on dueDate or today if missing
        const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10)
        ev.push({ title: h.name, start: dateStr, allDay: true, id: h.id })
      } else {
        // Schedule: timed event if time exists
        const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10)
        if (h.time) {
          const startIso = `${dateStr}T${(h.time)}:00`
          const endIso = h.endTime ? `${dateStr}T${h.endTime}:00` : undefined
          ev.push({ title: h.name, start: startIso, end: endIso, allDay: false, id: h.id })
        } else {
          ev.push({ title: h.name, start: dateStr, allDay: true, id: h.id })
        }
      }
    }
    return ev
  }, [habits])

  return (
    <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <h2 className="mb-3 text-lg font-medium">Calendar</h2>
      <FullCalendar
        plugins={[ timeGridPlugin, dayGridPlugin, interactionPlugin ]}
        initialView="timeGridWeek"
        visibleRange={{ start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,dayGridMonth' }}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        events={events}
        height={600}
      />
    </section>
  )
}
