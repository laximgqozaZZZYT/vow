"use client";

import { useState, useMemo, useEffect, useRef, useId } from "react";
import mermaid from 'mermaid'
import { NewGoalModal, NewHabitModal, HabitModal, NewFrameModal } from "./components/modals";
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import rrulePlugin from '@fullcalendar/rrule'
// FullCalendar CSS imports removed to avoid module resolution errors in this environment.
// If you want FullCalendar's default styles, consider adding them via a global CSS import
// or linking the CSS from a CDN in _document or app root.

type Goal = { id: string; name: string; details?: string; dueDate?: string; parentId?: string | null; createdAt: string; updatedAt: string };
type Habit = { id: string; goalId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; completed?: boolean; lastCompletedAt?: string; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; createdAt: string; updatedAt: string };

export default function DashboardPage() {
  const now = new Date().toISOString();
  const [goals, setGoals] = useState<Goal[]>([
    { id: "g1", name: "Engneer Expert", createdAt: now, updatedAt: now },
    { id: "g1-1", name: "Infra Expert", parentId: "g1", createdAt: now, updatedAt: now },
    { id: "g1-1-1", name: "IaC習得", parentId: "g1-1", createdAt: now, updatedAt: now },
    { id: "g1-1-2", name: "TypeScript", parentId: "g1-1", createdAt: now, updatedAt: now },
    { id: "g2", name: "健康", createdAt: now, updatedAt: now },
    { id: "g2-1", name: "タバコをやめる", parentId: "g2", createdAt: now, updatedAt: now },
    { id: "g2-2", name: "ダイエット", parentId: "g2", createdAt: now, updatedAt: now },
  ]);

  const [habits, setHabits] = useState<Habit[]>([
    { id: "h1", goalId: "g1-1-1", name: "Ansibleを用いたデプロイ", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
    { id: "h2", goalId: "g1-1-1", name: "Terraformを用いたデプロイ", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
  { id: "h3", goalId: "g1-1-2", name: "TODOアプリの作成", active: true, type: "do", count: 0, completed: false, time: "07:00", endTime: "07:30", repeat: "Daily", createdAt: now, updatedAt: now },

    { id: "h4", goalId: "g2-1", name: "喫煙", active: true, type: "avoid", count: 0, completed: false, createdAt: now, updatedAt: now },
    { id: "h5", goalId: "g2-1", name: "ニコチンパッチ", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },

    { id: "h6", goalId: "g2-2", name: "おやつを食べる", active: true, type: "avoid", count: 0, completed: false, createdAt: now, updatedAt: now },
    { id: "h7", goalId: "g2-2", name: "野菜を食べる", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
    { id: "h8", goalId: "g2-2", name: "運動", active: true, type: "do", count: 0, completed: false, createdAt: now, updatedAt: now },
  ]);

  const [selectedGoal, setSelectedGoal] = useState<string | null>(
    goals[0]?.id ?? null
  );
  const [showLeftPane, setShowLeftPane] = useState(false);

  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openNewHabit, setOpenNewHabit] = useState(false);
  const [openHabitModal, setOpenHabitModal] = useState(false);
  const [recurringRequest, setRecurringRequest] = useState<null | { habitId: string; start?: string; end?: string }>(null);
  const [openNewFrame, setOpenNewFrame] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [newHabitInitial, setNewHabitInitial] = useState<{ date?: string; time?: string } | null>(null);
  const [newHabitInitialType, setNewHabitInitialType] = useState<"do" | "avoid" | undefined>(undefined)
  const [frames, setFrames] = useState<any[]>(() => {
    const today = new Date().toISOString().slice(0,10)
    return [
      { id: 'f-default-morning', name: 'Morning free', kind: 'Blank', date: today, start_time: '07:00', end_time: '08:00', color: undefined },
      { id: 'f-default-lunch', name: 'Lunch free', kind: 'Blank', date: today, start_time: '12:00', end_time: '13:00', color: undefined },
      { id: 'f-default-evening', name: 'Evening free', kind: 'Blank', date: today, start_time: '20:00', end_time: '22:00', color: undefined },
    ]
  })

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  // Update habit when calendar event is moved/resized
  function handleEventChange(id: string, updated: { start?: string; end?: string }) {
    setHabits((s) => s.map(h => {
      if (h.id !== id) return h;
      const newDue = updated.start ? updated.start.slice(0,10) : h.dueDate
      const newTime = updated.start && updated.start.length > 10 ? updated.start.slice(11,16) : h.time
      const newEnd = updated.end && updated.end.length > 10 ? updated.end.slice(11,16) : h.endTime
      return { ...h, dueDate: newDue, time: newTime, endTime: newEnd, updatedAt: new Date().toISOString() }
    }))
  }

  // Update frame when calendar event (frame) is moved/resized
  function handleFrameChange(id: string, updated: { start?: string; end?: string }) {
    setFrames((s) => s.map(f => {
      if (f.id !== id) return f
      const newDate = updated.start ? updated.start.slice(0,10) : f.date
      const newStart = updated.start && updated.start.length > 10 ? updated.start.slice(11,16) : f.start_time
      const newEnd = updated.end && updated.end.length > 10 ? updated.end.slice(11,16) : f.end_time
      return { ...f, date: newDate, start_time: newStart, end_time: newEnd }
    }))
  }

  function createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    const id = `c${Date.now()}`;
    const now = new Date().toISOString();
    setGoals((s) => [
      ...s,
      { id, name: payload.name, details: payload.details, dueDate: payload.dueDate, parentId: payload.parentId ?? null, createdAt: now, updatedAt: now },
    ]);
    setSelectedGoal(id);
  }

  // Goal hierarchy helpers
  const goalsById = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals])
  const rootGoals = useMemo(() => goals.filter(g => !g.parentId), [goals])
  function childrenOf(id: string) {
    return goals.filter(g => g.parentId === id)
  }

  function setGoalParent(goalId: string, parentId: string | null) {
    setGoals((s) => s.map(g => g.id === goalId ? { ...g, parentId } : g))
  }

  function mergeGoals(sourceId: string, targetId: string) {
    // Move every habit from source to target, then remove source
    setHabits((s) => s.map(h => h.goalId === sourceId ? { ...h, goalId: targetId } : h))
    setGoals((s) => s.filter(g => g.id !== sourceId))
    if (selectedGoal === sourceId) setSelectedGoal(targetId)
  }

  function createHabit(payload: { name: string; goalId: string; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; policy?: "Schedule" | "Count"; targetCount?: number }) {
    const id = `h${Date.now()}`;
    const now = new Date().toISOString();
    setHabits((s) => [
      ...s,
      { id, goalId: payload.goalId, name: payload.name, active: true, type: payload.type, count: 0, must: payload.targetCount ?? undefined, policy: payload.policy ?? 'Schedule', targetCount: payload.targetCount ?? undefined, completed: false, duration: payload.duration, reminders: payload.reminders, dueDate: payload.dueDate, time: payload.time, endTime: payload.endTime, repeat: payload.repeat, allDay: payload.allDay, notes: payload.notes, createdAt: now, updatedAt: now },
    ]);
  }

  function createFrame(payload: { name?: string; kind: 'Blank' | 'Full'; date?: string; start_time: string; end_time: string; color?: string }) {
    const id = `f${Date.now()}`
    setFrames((s) => [...s, { id, name: payload.name, kind: payload.kind, date: payload.date, start_time: payload.start_time, end_time: payload.end_time, color: payload.color }])
  }

  // derived when needed

  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});

  function toggleGoal(id: string) {
    setOpenGoals((s) => ({ ...s, [id]: !s[id] }));
  }

  // per-goal "Only Habit" toggle (default OFF)
  const [onlyHabit, setOnlyHabit] = useState<Record<string, boolean>>({});
  function setOnlyHabitFor(goalId: string, value: boolean) {
    setOnlyHabit(s => ({ ...s, [goalId]: value }))
  }
  // determine effective OnlyHabit for a goal: check the goal itself, then walk up to parents; default false
  function effectiveOnlyHabit(goalId: string) {
    let g: Goal | undefined = goalsById[goalId]
    while (g) {
      if (onlyHabit[g.id] !== undefined) return onlyHabit[g.id]
      g = g.parentId ? goalsById[g.parentId] : undefined
    }
    return false
  }
  // helper: is goalA a descendant of goalB (including equality)
  function isDescendantOf(childGoalId: string, ancestorGoalId: string) {
    if (!childGoalId) return false
    if (childGoalId === ancestorGoalId) return true
    let g: Goal | undefined = goalsById[childGoalId]
    while (g && g.parentId) {
      if (g.parentId === ancestorGoalId) return true
      g = goalsById[g.parentId]
    }
    return false
  }

  // Recursive goal node renderer (renders up to 3 levels: root, child, grandchild)
  const GoalNode = ({ goal, depth = 1 }: { goal: Goal; depth?: number }) => {
    const isOpen = !!openGoals[goal.id]
    const kids = childrenOf(goal.id)
    const myHabits = habits.filter(h => h.goalId === goal.id)

    return (
      <div key={goal.id}>
        <div className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 ${selectedGoal === goal.id ? 'bg-zinc-100 dark:bg-white/5' : ''}`}>
          <div className="flex items-center gap-2">
            <button onClick={() => { toggleGoal(goal.id); setSelectedGoal(goal.id); }} className="inline-block w-3">{isOpen ? '▾' : '▸'}</button>
            <span className="text-sm font-medium">{goal.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={!!onlyHabit[goal.id]}
                onChange={(e) => { e.stopPropagation(); setOnlyHabitFor(goal.id, e.target.checked) }}
              />
              <span>Only Habit</span>
            </label>
          </div>
        </div>

        {isOpen && (
          <div className={`ml-6 mt-1 flex flex-col gap-1 ${depth >= 3 ? 'mb-2' : ''}`}>
            {effectiveOnlyHabit(goal.id) ? (
              // show all habits under this goal regardless of depth
              (() => {
                const nestedHabits = habits.filter(h => isDescendantOf(h.goalId, goal.id))
                return nestedHabits.length > 0 ? nestedHabits.map(h => (
                  <div
                    key={h.id}
                    onClick={() => { setSelectedGoal(goal.id); setSelectedHabitId(h.id); setOpenHabitModal(true); }}
                    className={`flex items-center justify-between rounded px-2 py-1 text-sm ${h.completed ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="truncate">{h.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        title="Complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          const now = new Date().toISOString();
                          setHabits((s) => s.map(x => {
                            if (x.id !== h.id) return x;
                            const policy = (x as any).policy ?? 'Schedule';
                            if (policy === 'Count') {
                              const prev = x.count ?? 0;
                              const newCount = prev + 1;
                              const must = x.must ?? (x as any).targetCount ?? 0;
                              if (must > 0 && newCount >= must) {
                                return { ...x, count: newCount, completed: true, lastCompletedAt: now, updatedAt: now };
                              }
                              return { ...x, count: newCount, lastCompletedAt: now, updatedAt: now };
                            } else {
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
                )) : <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
              })()
            ) : (
              // default hierarchical display
              <>
                {myHabits.map(h => (
                  <div
                    key={h.id}
                    onClick={() => { setSelectedGoal(goal.id); setSelectedHabitId(h.id); setOpenHabitModal(true); }}
                    className={`flex items-center justify-between rounded px-2 py-1 text-sm ${h.completed ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="truncate">{h.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        title="Complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          const now = new Date().toISOString();
                          setHabits((s) => s.map(x => {
                            if (x.id !== h.id) return x;
                            const policy = (x as any).policy ?? 'Schedule';
                            if (policy === 'Count') {
                              const prev = x.count ?? 0;
                              const newCount = prev + 1;
                              const must = x.must ?? (x as any).targetCount ?? 0;
                              if (must > 0 && newCount >= must) {
                                return { ...x, count: newCount, completed: true, lastCompletedAt: now, updatedAt: now };
                              }
                              return { ...x, count: newCount, lastCompletedAt: now, updatedAt: now };
                            } else {
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

                {myHabits.length === 0 && (
                  <div className="px-2 py-1 text-xs text-zinc-500">(no habits)</div>
                )}

                {/* render child goals recursively up to depth 3 */}
                {kids.map(k => (
                  depth < 3 ? (
                    <div key={k.id} className="ml-2 mt-1">
                      <GoalNode goal={k} depth={depth + 1} />
                    </div>
                  ) : (
                    <div key={k.id} className="ml-4 mt-1">
                      <div className="flex items-center justify-between rounded px-2 py-1 text-sm">
                        <div className="flex items-center gap-2"><span className="text-sm">{k.name}</span></div>
                        <div className="text-xs text-zinc-500">{habits.filter(h => h.goalId === k.id).length}</div>
                      </div>
                    </div>
                  )
                ))}
              </>
            )}
          </div>
        )}
      </div>
    )
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
          {rootGoals.map((c) => (
            <GoalNode key={c.id} goal={c} depth={1} />
          ))}
        </nav>

          <div className="mt-auto flex gap-2 pt-4">
          <button
            className="flex-1 rounded border px-3 py-2 text-sm"
            onClick={() => setOpenNewCategory(true)}
          >
            + New Goal
          </button>
          <button
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white"
            onClick={() => setOpenNewHabit(true)}
          >
            + New Habit
          </button>
            <button
              className="flex-1 rounded border px-3 py-2 text-sm"
              onClick={() => setOpenNewFrame(true)}
            >
              + New Frame
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

  <FullCalendarWrapper
    habits={habits}
    onEventClick={(id: string) => { setSelectedHabitId(id); setOpenHabitModal(true); }}
    onSlotSelect={(isoDate: string, time?: string) => {
      // If a frame exists at this date/time, open New Habit; otherwise open New Frame
      const found = frames.find(f => {
        if (!f.date) return false
        if (f.date !== isoDate) return false
        if (!time) return true
        return time >= f.start_time && time < f.end_time
      })
      if (found) {
        setNewHabitInitial({ date: isoDate, time }); setNewHabitInitialType(found.kind === 'Blank' ? 'do' : undefined); setOpenNewHabit(true)
      } else {
        setNewHabitInitial({ date: isoDate, time }); setOpenNewFrame(true)
      }
    }}
    onEventChange={(id: string, updated) => handleEventChange(id, updated)}
  onFrameChange={(id: string, updated) => handleFrameChange(id, updated)}
    frames={frames}
    onFrameClick={(frame: any, start?: Date) => {
      // open new habit prefilled with frame date/time and Good type
      const iso = frame.date ?? (start ? start.toISOString().slice(0,10) : undefined)
      const time = start ? start.toISOString().slice(11,16) : undefined
      setNewHabitInitial({ date: iso, time })
      setNewHabitInitialType('do')
      setOpenNewHabit(true)
    }}
    onRecurringAttempt={(habitId: string, updated) => {
      // open modal asking whether to apply to all same-name habits or only this occurrence
      setRecurringRequest({ habitId, start: updated.start, end: updated.end })
    }}
  />
        <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
          <h2 className="mb-3 text-lg font-medium">Recent Activity</h2>
          <ul className="flex flex-col gap-2 text-sm text-zinc-600">
            <li>早起き — completed</li>
            <li>メール確認 — skipped</li>
            <li>タスクレビュー — completed</li>
          </ul>
        </section>

        {/* Goal graph (Mermaid TD) shown under the calendar */}
        <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
          <h2 className="mb-3 text-lg font-medium">Goals</h2>
          <GoalMermaid goals={goals} habits={habits} openGoals={openGoals} toggleGoal={toggleGoal} setGoalParent={setGoalParent} mergeGoals={mergeGoals} />
        </section>
      </main>

      <NewGoalModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        onCreate={(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => createGoal(payload)}
        goals={goals}
      />

      <NewHabitModal
        open={openNewHabit}
        onClose={() => { setOpenNewHabit(false); setNewHabitInitial(null); setNewHabitInitialType(undefined); }}
        onCreate={(payload) => createHabit(payload)}
        categories={goals}
        initialDate={newHabitInitial?.date}
        initialTime={newHabitInitial?.time}
        initialType={newHabitInitialType}
      />
      <NewFrameModal
        open={openNewFrame}
        onClose={() => { setOpenNewFrame(false); setNewHabitInitial(null); }}
        onCreate={(payload) => createFrame(payload)}
        initialDate={newHabitInitial?.date}
        initialTime={newHabitInitial?.time}
      />
      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit}
        onUpdate={(updated) => setHabits((s) => s.map(h => h.id === updated.id ? updated : h))}
        onDelete={(id) => setHabits((s) => s.filter(h => h.id !== id))}
        categories={goals}
      />

      {/* Recurring-change confirmation modal */}
      {recurringRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRecurringRequest(null)} />
          <div className="relative w-full max-w-lg rounded bg-white p-6 shadow">
            <h3 className="text-lg font-semibold">Recurring habit moved</h3>
            <p className="mt-3 text-sm text-zinc-600">You moved a recurring habit. Choose how to apply the change:</p>
            <div className="mt-4 flex gap-2">
              <button
                className="rounded bg-sky-600 px-3 py-2 text-white"
                onClick={() => {
                  // YES: update all same-name recurring habits (change their template time)
                  const original = habits.find(x => x.id === recurringRequest.habitId)
                  if (!original) { setRecurringRequest(null); return }
                  const start = recurringRequest.start
                  const end = recurringRequest.end
                  const newTime = start && start.length > 10 ? start.slice(11,16) : original.time
                  const newEnd = end && end.length > 10 ? end.slice(11,16) : original.endTime
                  const now = new Date().toISOString()
                  // update every habit that has the same name and is recurring (has repeat)
                  setHabits(s => s.map(x => {
                    if (x.name === original.name && (x.repeat && x.repeat !== 'Does not repeat')) {
                      return { ...x, time: newTime, endTime: newEnd, updatedAt: now }
                    }
                    return x
                  }))
                  setRecurringRequest(null)
                }}
              >
                Yes
              </button>
              <button
                className="rounded border px-3 py-2"
                onClick={() => {
                  // NO: apply only to this occurrence (create one-off)
                  const h = habits.find(x => x.id === recurringRequest.habitId)
                  if (!h) { setRecurringRequest(null); return }
                  const start = recurringRequest.start
                  const end = recurringRequest.end
                  const date = start ? start.slice(0,10) : undefined
                  const time = start && start.length > 10 ? start.slice(11,16) : h.time
                  const endTime = end && end.length > 10 ? end.slice(11,16) : h.endTime
                  createHabit({ name: h.name, goalId: h.goalId, type: h.type, dueDate: date, time, endTime, repeat: undefined, policy: (h as any).policy ?? 'Schedule' })
                  setRecurringRequest(null)
                }}
              >
                No
              </button>
              <button className="ml-auto rounded border px-3 py-2 text-sm text-zinc-500" onClick={() => setRecurringRequest(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FullCalendarWrapper({ habits, onEventClick, onSlotSelect, onEventChange, frames, onFrameClick, onFrameChange, onRecurringAttempt }: { habits: Habit[]; onEventClick?: (id: string) => void; onSlotSelect?: (isoDate: string, time?: string) => void; onEventChange?: (id: string, updated: { start?: string; end?: string }) => void; frames?: any[]; onFrameClick?: (frame: any, start?: Date) => void; onFrameChange?: (id: string, updated: { start?: string; end?: string }) => void; onRecurringAttempt?: (habitId: string, updated: { start?: string; end?: string }) => void }) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0,0,0,0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  const calendarRef = useRef<any>(null)
  const [navSelection, setNavSelection] = useState<'today' | 'tomorrow' | 'week' | 'month'>('today')
  // displayFormat removed: always use calendar TD for today/tomorrow

  const events = useMemo(() => {
    const ev: any[] = []
    for (const h of (habits ?? [])) {
      // Skip rendering habits that are 'avoid' (Bad) by default
      if (h.type === 'avoid') continue
      const policy = (h as any).policy ?? 'Schedule'
      if (policy === 'Count') {
        // all-day event on dueDate or today if missing
        const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10)
        ev.push({ title: h.name, start: dateStr, allDay: true, id: h.id })
      } else {
        // Schedule: timed event if time exists
        const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10)
        // If there's a repeat rule, try to create an rrule-backed event
        if (h.repeat && h.repeat !== 'Does not repeat') {
          // basic mapping to rrule freq
          const freq = h.repeat === 'Daily' ? 'DAILY' : h.repeat === 'Weekly' ? 'WEEKLY' : h.repeat === 'Monthly' ? 'MONTHLY' : h.repeat === 'Yearly' ? 'YEARLY' : undefined
          if (freq) {
            // If timed, provide dtstart including time and a duration so each occurrence occupies the same time window
            if (h.time) {
              const dtstart = `${dateStr}T${h.time}:00`
              // compute duration from endTime if present, otherwise default to 1 hour
              let durationIso: string | undefined = undefined
              if (h.endTime) {
                const [sh, sm] = h.time.split(':').map((x: string) => parseInt(x, 10))
                const [eh, em] = h.endTime.split(':').map((x: string) => parseInt(x, 10))
                let startMinutes = sh * 60 + sm
                let endMinutes = eh * 60 + em
                // if end is before or equal to start, assume end is on next day
                if (endMinutes <= startMinutes) endMinutes += 24 * 60
                const diff = endMinutes - startMinutes
                const hours = Math.floor(diff / 60)
                const mins = diff % 60
                // FullCalendar expects a duration like "HH:MM:SS" for rrule events — use that format (e.g. 00:30:00)
                const hh = String(hours).padStart(2, '0')
                const mm = String(mins).padStart(2, '0')
                durationIso = `${hh}:${mm}:00`
                if (durationIso === '00:00:00') durationIso = '01:00:00'
              } else {
                durationIso = '01:00:00'
              }

                ev.push({
                  title: h.name,
                  rrule: { freq, dtstart },
                  duration: durationIso,
                  id: h.id,
                  // allow dragging recurring events; we'll intercept the action and ask the user
                  editable: true,
                  startEditable: true,
                  durationEditable: true,
                  // custom flag so handlers can detect recurring-origin events
                  isRecurring: true,
                })
              continue
            } else {
              // all-day recurrence
                ev.push({ title: h.name, rrule: { freq, dtstart: dateStr }, id: h.id, editable: true, startEditable: true, durationEditable: true, isRecurring: true })
              continue
            }
          }
        }
        if (h.time) {
          const startIso = `${dateStr}T${(h.time)}:00`
          const endIso = h.endTime ? `${dateStr}T${h.endTime}:00` : undefined
          ev.push({ title: h.name, start: startIso, end: endIso, allDay: false, id: h.id, editable: true, className: 'vow-habit' })
        } else {
          ev.push({ title: h.name, start: dateStr, allDay: true, id: h.id, editable: true, className: 'vow-habit' })
        }
      }
    }
    // Add frames rendered as styled events so they can have borders and be overlaid by habits
    for (const f of (frames ?? [])) {
      if (!f.date) continue
      const startIso = `${f.date}T${f.start_time}:00`
      const endIso = `${f.date}T${f.end_time}:00`
      const cls = `vow-frame ${f.kind === 'Blank' ? 'vow-frame-blank' : 'vow-frame-full'}`
      ev.push({ title: f.name ?? '', start: startIso, end: endIso, allDay: false, id: f.id, className: cls, editable: true })
    }
    return ev
  }, [habits, frames])

  // precompute day events/arcs for today/tomorrow
  const isDayNav = (navSelection === 'today' || navSelection === 'tomorrow')
  const selectedDate = (() => {
    const d = new Date()
    if (navSelection === 'tomorrow') d.setDate(d.getDate() + 1)
    return d
  })()
  const selectedIso = selectedDate.toISOString().slice(0,10)
  const dayEvents = events.filter((ev: any) => ev.allDay ? ev.start === selectedIso : ev.start && ev.start.slice(0,10) === selectedIso)
  const dayArcs = dayEvents.map((ev: any) => {
    if (ev.allDay) return null as any
    const s = new Date(ev.start)
    const e = ev.end ? new Date(ev.end) : new Date(s.getTime() + 60*60*1000)
    const startMin = s.getHours()*60 + s.getMinutes()
    const endMin = e.getHours()*60 + e.getMinutes()
    return { title: ev.title, startMin, endMin }
  }).filter(Boolean) as Array<{ title: string; startMin: number; endMin: number }>
  const totalMin = 24 * 60
  function arcPath(startMin: number, endMin: number) {
    const cx = 200, cy = 200, r = 140
    const startAngle = (startMin/totalMin) * 2*Math.PI - Math.PI/2
    const endAngle = (endMin/totalMin) * 2*Math.PI - Math.PI/2
    const x1 = cx + r*Math.cos(startAngle)
    const y1 = cy + r*Math.sin(startAngle)
    const x2 = cx + r*Math.cos(endAngle)
    const y2 = cy + r*Math.sin(endAngle)
    const large = endMin - startMin > totalMin/2 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
  }

  return (
    <section className="mt-6 rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <h2 className="mb-3 text-lg font-medium">Calendar</h2>
      <div className="mb-3 flex items-center gap-2">
        {/* custom nav buttons: today / tomorrow / week / month */}
        {(['today','tomorrow','week','month'] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => {
              const cal = calendarRef.current?.getApi?.()
              if (!cal) return
              if (b === 'today') {
                cal.gotoDate(new Date())
                // show only today's schedule
                cal.changeView('timeGridDay')
                setNavSelection('today')
              } else if (b === 'tomorrow') {
                const t = new Date(); t.setDate(t.getDate() + 1)
                cal.gotoDate(t)
                // show only tomorrow's schedule
                cal.changeView('timeGridDay')
                setNavSelection('tomorrow')
              } else if (b === 'week') {
                cal.changeView('timeGridWeek')
                setNavSelection('week')
              } else if (b === 'month') {
                cal.changeView('dayGridMonth')
                setNavSelection('month')
              }
            }}
            className={`rounded px-3 py-1 text-sm ${navSelection === b ? 'bg-sky-600 text-white' : 'bg-white dark:bg-slate-800 border text-slate-700 dark:text-slate-200'}`}
          >
            {b === 'today' ? 'today' : b === 'tomorrow' ? 'tomorrow' : b === 'week' ? 'week' : 'month'}
          </button>
        ))}
      </div>
      {/* Always show FullCalendar. For today/tomorrow nav we use timeGridDay. */}
      <FullCalendar
        ref={calendarRef}
        plugins={[ timeGridPlugin, dayGridPlugin, interactionPlugin, rrulePlugin ]}
        initialView={navSelection === 'today' || navSelection === 'tomorrow' ? 'timeGridDay' : navSelection === 'week' ? 'timeGridWeek' : 'dayGridMonth'}
        editable={true}
        eventStartEditable={true}
        eventDurationEditable={true}
        eventResizableFromStart={true}
        // don't provide a fixed visibleRange so navigation works; header only shows prev/next/title
        headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        selectable={true}
        selectMirror={true}
        select={(selectionInfo) => {
          // selectionInfo has startStr/start and startTimme
          const iso = selectionInfo.startStr?.slice(0,10) ?? selectionInfo.start?.toISOString().slice(0,10)
          const time = selectionInfo.startStr && selectionInfo.startStr.length > 10 ? selectionInfo.startStr.slice(11,16) : undefined
          if (onSlotSelect && iso) onSlotSelect(iso, time)
        }}
        eventClick={(clickInfo) => {
          const id = clickInfo.event.id
          // if this id is a frame, call onFrameClick
          const frame = (frames ?? []).find(f => f.id === id)
          if (frame && onFrameClick) {
            onFrameClick(frame, clickInfo.event.start ?? undefined)
            return
          }
          if (onEventClick) onEventClick(id)
        }}
        dateClick={(dateClickInfo) => {
          // single click on empty calendar slot
          const iso = dateClickInfo.dateStr?.slice(0,10) ?? dateClickInfo.date?.toISOString().slice(0,10)
          const time = dateClickInfo.dateStr && dateClickInfo.dateStr.length > 10 ? dateClickInfo.dateStr.slice(11,16) : undefined
          if (onSlotSelect && iso) onSlotSelect(iso, time)
        }}
        eventDrop={(dropInfo) => {
          const id = dropInfo.event.id
          const startStr = (dropInfo.event.startStr as string) ?? (dropInfo.event.start ? dropInfo.event.start.toISOString() : undefined)
          const endStr = (dropInfo.event.endStr as string) ?? (dropInfo.event.end ? dropInfo.event.end.toISOString() : undefined)
          const frame = (frames ?? []).find(f => f.id === id)
          // if this event came from a recurring rule, revert the change and notify parent
          const isRecurring = (dropInfo.event.extendedProps && (dropInfo.event.extendedProps as any).isRecurring) || ((dropInfo.event as any)._def && (dropInfo.event as any)._def.recurringDef)
          if (isRecurring) {
            // undo the visual move
            try { dropInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(id, { start: startStr, end: endStr })
            return
          }
          if (frame && onFrameChange) {
            onFrameChange(id, { start: startStr, end: endStr })
            return
          }
          if (onEventChange) onEventChange(id, { start: startStr, end: endStr })
        }}
        eventResize={(resizeInfo) => {
          const id = resizeInfo.event.id
          const startStr = (resizeInfo.event.startStr as string) ?? (resizeInfo.event.start ? resizeInfo.event.start.toISOString() : undefined)
          const endStr = (resizeInfo.event.endStr as string) ?? (resizeInfo.event.end ? resizeInfo.event.end.toISOString() : undefined)
          const frame = (frames ?? []).find(f => f.id === id)
          const isRecurring = (resizeInfo.event.extendedProps && (resizeInfo.event.extendedProps as any).isRecurring) || ((resizeInfo.event as any)._def && (resizeInfo.event as any)._def.recurringDef)
          if (isRecurring) {
            try { resizeInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(id, { start: startStr, end: endStr })
            return
          }
          if (frame && onFrameChange) {
            onFrameChange(id, { start: startStr, end: endStr })
            return
          }
          if (onEventChange) onEventChange(id, { start: startStr, end: endStr })
        }}
        events={events}
        height={600}
      />
    </section>
  );
}

// Simplified GoalMermaid: generate a mermaid flowchart text and render as fallback preformatted text.
function GoalMermaid({ goals }: { goals: Goal[]; habits?: Habit[]; openGoals?: Record<string, boolean>; toggleGoal?: (id: string) => void; setGoalParent?: (goalId: string, parentId: string | null) => void; mergeGoals?: (sourceId: string, targetId: string) => void }) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement | null>(null)
  const graph = useMemo(() => {
    let s = 'flowchart TD\n'
    for (const g of goals) {
      const gid = `G_${g.id.replace(/[^a-zA-Z0-9_]/g, '_')}`
      s += `  ${gid}["${g.name.replace(/"/g, '\\"')}"]\n`
      if (g.parentId) {
        const pgid = `G_${g.parentId.replace(/[^a-zA-Z0-9_]/g, '_')}`
        s += `  ${pgid} --> ${gid}\n`
      }
    }
    return s
  }, [goals])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let cancelled = false
    const render = async () => {
      try {
        // ensure mermaid is initialized
        if ((mermaid as any).initialize) {
          try { mermaid.initialize({ startOnLoad: false }) } catch (e) { /* ignore */ }
        }
        // mermaid.mermaidAPI.render may return a promise or string depending on version
        const renderId = id + '-svg'
        const api = (mermaid as any).mermaidAPI || (mermaid as any)
        if (!api || !api.render) {
          // fallback: show plain graph source
          el.innerText = graph
          return
        }
        const res = api.render(renderId, graph)
        const svg = res && typeof res.then === 'function' ? await res : res
        if (cancelled) return
        if (typeof svg === 'string') {
          el.innerHTML = svg
        } else if (svg && typeof svg === 'object' && typeof svg.svg === 'string') {
          el.innerHTML = svg.svg
        } else {
          el.innerText = String(svg)
        }
      } catch (e: any) {
        el.innerText = String(e) || graph
      }
    }
    render()
    return () => { cancelled = true }
  }, [graph, id])

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500">Parent relationships (Mermaid preview)</div>
      </div>
      <div ref={containerRef} className="overflow-auto border rounded p-2" style={{ minHeight: 120 }} />
    </div>
  )
}
