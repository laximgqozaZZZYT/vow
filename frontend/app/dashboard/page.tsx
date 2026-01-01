"use client";

import { useState, useMemo, useEffect, useRef, useId } from "react";
import mermaid from 'mermaid'
import { HabitModal, GoalModal } from "./components/modals";
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import rrulePlugin from '@fullcalendar/rrule'
// FullCalendar CSS imports removed to avoid module resolution errors in this environment.
// If you want FullCalendar's default styles, consider adding them via a global CSS import
// or linking the CSS from a CDN in _document or app root.

type Goal = { id: string; name: string; details?: string; dueDate?: string | Date | null; parentId?: string | null; createdAt: string; updatedAt: string };
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
  type Activity = { id: string; habitId: string; habitName: string; timestamp: string; amount: number; prevCount: number; newCount: number }
  const [activities, setActivities] = useState<Activity[]>([]);
  const [recurringRequest, setRecurringRequest] = useState<null | { habitId: string; start?: string; end?: string }>(null);
  // frames feature removed: no openNewFrame state
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [newHabitInitial, setNewHabitInitial] = useState<{ date?: string; time?: string } | null>(null);
  const [newHabitInitialType, setNewHabitInitialType] = useState<"do" | "avoid" | undefined>(undefined)
  // frames removed

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

  // frame handlers removed

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

  function createHabit(payload: { name: string; goalId: string; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; timings?: any[]; allDay?: boolean; notes?: string; workloadUnit?: string; workloadTotal?: number; workloadPerCount?: number }) {
    const id = `h${Date.now()}`;
    const now = new Date().toISOString();
    setHabits((s) => [
      ...s,
      { id, goalId: payload.goalId, name: payload.name, active: true, type: payload.type, count: 0, must: payload.workloadTotal ?? undefined, workloadUnit: payload.workloadUnit ?? undefined, workloadTotal: payload.workloadTotal ?? undefined, workloadPerCount: payload.workloadPerCount ?? undefined, completed: false, duration: payload.duration, reminders: payload.reminders, dueDate: payload.dueDate, time: payload.time, endTime: payload.endTime, repeat: payload.repeat, timings: payload.timings, allDay: payload.allDay, notes: payload.notes, createdAt: now, updatedAt: now },
    ]);
  }

  function handleComplete(habitId: string) {
    const now = new Date().toISOString();
    let recordedActivity: Activity | null = null;
    setHabits((s) => s.map(x => {
      if (x.id !== habitId) return x;
      const increment = (x as any).workloadPerCount ?? 1;
      const prev = x.count ?? 0;
      const newCount = prev + increment;
      const total = (x as any).workloadTotal ?? x.must ?? 0;
      recordedActivity = { id: `a${Date.now()}`, habitId: x.id, habitName: x.name, timestamp: now, amount: increment, prevCount: prev, newCount };
      if (total > 0) {
        if (newCount >= total) {
          return { ...x, count: newCount, completed: true, lastCompletedAt: now, updatedAt: now };
        }
        return { ...x, count: newCount, lastCompletedAt: now, updatedAt: now };
      }
  // no workload total -> increment count and mark as completed (schedule-style)
  return { ...x, count: newCount, completed: true, lastCompletedAt: now, updatedAt: now };
    }));

    // avoid recording duplicate activities caused by quick double-clicks: if the latest activity is for the same habit and within 1s, skip
    setActivities(a => {
      if (!recordedActivity) return a;
      if (a.length && a[0].habitId === habitId && (Date.now() - new Date(a[0].timestamp).getTime() < 1000)) {
        return a;
      }
      return [recordedActivity, ...a];
    });
  }

  function handleDeleteActivity(activityId: string) {
    const act = activities.find(a => a.id === activityId);
    if (!act) return;
    // rollback habit count to prevCount and adjust completed flag
    setHabits(s => s.map(h => {
      if (h.id !== act.habitId) return h;
      const total = (h as any).workloadTotal ?? h.must ?? 0;
      const completed = (typeof act.prevCount === 'number' && total > 0) ? (act.prevCount >= total) : false;
      return { ...h, count: act.prevCount, completed, updatedAt: new Date().toISOString() };
    }));
    // remove activity
    setActivities(s => s.filter(a => a.id !== activityId));
  }

  // frames feature removed: no createFrame function

  // derived when needed

  const [openGoals, setOpenGoals] = useState<Record<string, boolean>>({});
  const [openGoalModal, setOpenGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  const editingGoal = goals.find(g => g.id === editingGoalId) ?? null;

  // Accept partial updates (createdAt/updatedAt may be omitted by the modal)
  function updateGoal(updated: Partial<Goal> & { id: string }) {
    setGoals((s) => s.map(g => g.id === updated.id ? { ...g, ...updated, updatedAt: new Date().toISOString() } : g));
  }

  function deleteGoal(id: string) {
    // remove the goal and any child goals (simple approach: filter by id)
    setGoals((s) => s.filter(g => g.id !== id));
    // also reassign or remove habits under that goal: here we remove habits belonging to that goal
    setHabits((s) => s.filter(h => h.goalId !== id));
    if (selectedGoal === id) setSelectedGoal(null);
    if (editingGoalId === id) setEditingGoalId(null);
  }

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
            <button onClick={() => { setEditingGoalId(goal.id); setOpenGoalModal(true); }} className="text-sm font-medium text-left">{goal.name}</button>
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
                        onClick={(e) => { e.stopPropagation(); handleComplete(h.id) }}
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
                      <button title="Complete" onClick={(e) => { e.stopPropagation(); handleComplete(h.id) }} className="text-green-600 hover:bg-green-50 rounded px-2 py-1">✅</button>
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
            {/* Frame feature removed */}
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

  <div className="mt-6 grid grid-cols-1 gap-4">
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <h2 className="mb-3 text-lg font-medium">Next</h2>
      {/* Show up to 3 habits that are in-progress or upcoming (exclude completed) */}
      {/* Simple heuristic: in-progress = has timed event that overlaps current time today; upcoming = has time today later or has a dueDate in future or recurring timing */}
      {(() => {
        const now = new Date()
        const today = now.toISOString().slice(0,10)
        const inProgress: Habit[] = []
        const upcoming: Habit[] = []
        for (const h of habits) {
          if (h.completed) continue
          if (h.type === 'avoid') continue
          // prefer explicit timings if present
          const timings = (h as any).timings ?? []
          let added = false
          if (timings && timings.length) {
            for (const t of timings) {
              try {
                if (t.type === 'Date' && t.date === today && t.start && t.end) {
                  const start = new Date(`${t.date}T${t.start}:00`)
                  const end = new Date(`${t.date}T${t.end}:00`)
                  if (start <= now && now <= end) { inProgress.push(h); added = true; break }
                  if (now < start) { upcoming.push(h); added = true; break }
                } else if ((t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly') && t.start) {
                  // check today's start time
                  const dateStr = t.date ?? h.dueDate ?? today
                  const start = new Date(`${dateStr}T${t.start}:00`)
                  const end = t.end ? new Date(`${dateStr}T${t.end}:00`) : new Date(start.getTime() + 60*60*1000)
                  if (start <= now && now <= end) { inProgress.push(h); added = true; break }
                  if (now < start) { upcoming.push(h); added = true; break }
                }
              } catch (e) { /* ignore malformed */ }
            }
          }
          if (added) continue
          // fallback: use h.time / dueDate
          if (h.time) {
            const dateStr = h.dueDate ?? today
            const start = new Date(`${dateStr}T${h.time}:00`)
            const end = h.endTime ? new Date(`${dateStr}T${h.endTime}:00`) : new Date(start.getTime() + 60*60*1000)
            if (start <= now && now <= end) { inProgress.push(h); continue }
            if (now < start) { upcoming.push(h); continue }
          }
          if (h.dueDate) {
            const due = new Date(h.dueDate)
            if (due > now) upcoming.push(h)
          }
        }

        // de-duplicate and limit to 3, prefer inProgress first
        const uniq = new Map<string, Habit>()
        const pick: Habit[] = []
        for (const h of inProgress.concat(upcoming)) {
          if (uniq.has(h.id)) continue
          uniq.set(h.id, h)
          pick.push(h)
          if (pick.length >= 3) break
        }

        if (pick.length === 0) return <div className="text-sm text-zinc-500">No upcoming habits</div>

        return (
          <ul className="flex flex-col">
            {pick.map((h, idx) => (
              <li key={h.id} className={`flex items-center justify-between py-2 ${idx > 0 ? 'mt-2 border-t border-zinc-100 pt-3' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-sky-500" />
                  <div className={`text-sm ${h.completed ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}`}>{h.name}</div>
                </div>
                <div className="text-xs text-zinc-500">
                  {/* show a small hint: in-progress or time/due */}
                  {(() => {
                    // simple label
                    const now = new Date()
                    const today = now.toISOString().slice(0,10)
                    const timings = (h as any).timings ?? []
                    for (const t of timings) {
                      try {
                        if (t.type === 'Date' && t.date === today && t.start && t.end) {
                          const start = new Date(`${t.date}T${t.start}:00`)
                          const end = new Date(`${t.date}T${t.end}:00`)
                          if (start <= now && now <= end) return 'In progress'
                          if (now < start) return `${t.start}`
                        }
                        if ((t.type === 'Daily' || t.type === 'Weekly' || t.type === 'Monthly') && t.start) {
                          const dateStr = t.date ?? h.dueDate ?? today
                          const start = new Date(`${dateStr}T${t.start}:00`)
                          const end = t.end ? new Date(`${dateStr}T${t.end}:00`) : new Date(start.getTime() + 60*60*1000)
                          if (start <= now && now <= end) return 'In progress'
                          if (now < start) return `${t.start}`
                        }
                      } catch (e) {}
                    }
                    if (h.time) {
                      const dateStr = h.dueDate ?? today
                      const start = new Date(`${dateStr}T${h.time}:00`)
                      const end = h.endTime ? new Date(`${dateStr}T${h.endTime}:00`) : new Date(start.getTime() + 60*60*1000)
                      if (start <= now && now <= end) return 'In progress'
                      if (now < start) return `${h.time}`
                    }
                    if (h.dueDate) return `Due ${h.dueDate}`
                    return 'Planned'
                  })()}
                </div>
              </li>
            ))}
          </ul>
        )
      })()}
    </section>

    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b] mt-4">
      <h2 className="mb-3 text-lg font-medium">Activity</h2>
      <div className="space-y-2">
  {activities.length === 0 && <div className="text-xs text-zinc-500">No activity yet.</div>}
  {[...activities].sort((a,b) => b.timestamp.localeCompare(a.timestamp)).map(act => (
          <div key={act.id} className="flex items-center justify-between rounded px-2 py-2 hover:bg-zinc-100 dark:hover:bg-white/5">
            <div className="text-sm">
              <div className="text-xs text-zinc-500">{new Date(act.timestamp).toLocaleString()}</div>
              <div>{act.habitName} — completed {act.amount} {act.amount > 1 ? 'units' : 'unit'}. (now {act.newCount})</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-sm text-blue-600" onClick={() => { setSelectedHabitId(act.habitId); setOpenHabitModal(true); }}>Edit</button>
              <button className="text-sm text-red-600" onClick={() => handleDeleteActivity(act.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>

    <FullCalendarWrapper
    habits={habits}
    onEventClick={(id: string) => { setSelectedHabitId(id); setOpenHabitModal(true); }}
    onSlotSelect={(isoDate: string, time?: string) => {
      // open habit creation prefilled with selected slot
      setNewHabitInitial({ date: isoDate, time }); setOpenNewHabit(true)
    }}
    onEventChange={(id: string, updated) => handleEventChange(id, updated)}
    
    onRecurringAttempt={(habitId: string, updated) => {
      // open modal asking whether to apply to all same-name habits or only this occurrence
      setRecurringRequest({ habitId, start: updated.start, end: updated.end })
    }}
  />
  </div>
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

      <GoalModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        goal={null}
        onCreate={(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => createGoal(payload)}
        goals={goals}
      />

      <GoalModal
        open={openGoalModal}
        onClose={() => { setOpenGoalModal(false); setEditingGoalId(null); }}
        goal={editingGoal}
        onUpdate={(g) => updateGoal(g)}
        onDelete={(id) => deleteGoal(id)}
        goals={goals}
      />

      {/* NewHabit: creation modal (Frame feature removed) */}
      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit}
        onUpdate={(updated) => setHabits((s) => s.map(h => h.id === updated.id ? updated : h))}
        onDelete={(id) => setHabits((s) => s.filter(h => h.id !== id))}
        categories={goals}
      />

      {/* Creation modal: reuse HabitModal for New Habit */}
      <HabitModal
        open={openNewHabit}
        onClose={() => { setOpenNewHabit(false); setNewHabitInitial(null); setNewHabitInitialType(undefined); }}
        habit={null}
        initial={{ date: newHabitInitial?.date, time: newHabitInitial?.time, type: newHabitInitialType }}
        onCreate={(payload) => {
          createHabit(payload as any)
        }}
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
                  createHabit({ name: h.name, goalId: h.goalId, type: h.type, dueDate: date, time, endTime, repeat: undefined, workloadUnit: (h as any).workloadUnit ?? undefined, workloadTotal: (h as any).workloadTotal ?? undefined, workloadPerCount: (h as any).workloadPerCount ?? 1 })
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

function FullCalendarWrapper({ habits, onEventClick, onSlotSelect, onEventChange, onRecurringAttempt }: { habits: Habit[]; onEventClick?: (id: string) => void; onSlotSelect?: (isoDate: string, time?: string) => void; onEventChange?: (id: string, updated: { start?: string; end?: string }) => void; onRecurringAttempt?: (habitId: string, updated: { start?: string; end?: string }) => void }) {
  const now = new Date()
  const EXPAND_DAYS = 90 // when outdates present, expand recurring timings this many days into the future
  function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
  function parseYmd(s?: string) { if (!s) return undefined; const parts = s.split('-').map(x => Number(x)); if (parts.length>=3 && !Number.isNaN(parts[0])) return new Date(parts[0], parts[1]-1, parts[2]); const dd = new Date(s); return isNaN(dd.getTime()) ? undefined : dd }

  // Given an event interval [s,e) and an array of outdate Timing entries, return array of remaining intervals (non-overlapping with outdates)
  function subtractOutdatesFromInterval(s: Date, e: Date, outdates: any[] = [], habit?: any): Array<{ start: Date; end: Date }> {
    if (!outdates || outdates.length === 0) return [{ start: s, end: e }]
    // gather exclusion intervals for the date range of [s,e)
    const exs: Array<{ start: Date; end: Date }> = []
    // for each outdate timing, determine occurrences that may overlap (we'll evaluate by day between s and e)
    const day0 = new Date(s); day0.setHours(0,0,0,0)
    const dayN = new Date(e); dayN.setHours(0,0,0,0)
    const days = Math.max(1, Math.ceil((dayN.getTime() - day0.getTime())/(24*3600*1000)) + 1)
    for (const od of outdates) {
      for (let i=0;i<days;i++) {
        const d = addDays(day0, i)
        // check if outdate applies to this date
        if (od.type === 'Date') {
          if (!od.date) continue
          const odDate = parseYmd(od.date)
          if (!odDate) continue
          if (odDate.getFullYear() === d.getFullYear() && odDate.getMonth() === d.getMonth() && odDate.getDate() === d.getDate()) {
            if (od.start) {
              const exsStart = new Date(`${od.date}T${od.start}:00`)
              const exsEnd = od.end ? new Date(`${od.date}T${od.end}:00`) : new Date(exsStart.getTime() + 60*60*1000)
              exs.push({ start: exsStart, end: exsEnd })
            } else {
              // all-day exclusion: exclude whole day
              const exsStart = new Date(d); exsStart.setHours(0,0,0,0)
              const exsEnd = new Date(d); exsEnd.setHours(23,59,59,999)
              exs.push({ start: exsStart, end: exsEnd })
            }
          }
        } else if (od.type === 'Daily') {
          // applies every day
          if (od.start) {
            const dateStr = ymd(d)
            const exsStart = new Date(`${dateStr}T${od.start}:00`)
            const exsEnd = od.end ? new Date(`${dateStr}T${od.end}:00`) : new Date(exsStart.getTime() + 60*60*1000)
            exs.push({ start: exsStart, end: exsEnd })
          } else {
            const exsStart = new Date(d); exsStart.setHours(0,0,0,0)
            const exsEnd = new Date(d); exsEnd.setHours(23,59,59,999)
            exs.push({ start: exsStart, end: exsEnd })
          }
        } else if (od.type === 'Weekly') {
          // optional cron format WEEKDAYS:0,1,2
          let weekdays: number[] | null = null
          if (od.cron && String(od.cron).startsWith('WEEKDAYS:')) weekdays = (od.cron.split(':')[1] || '').split(',').map((x: string) => Number(x)).filter((n: number) => !Number.isNaN(n))
          if (!weekdays || weekdays.includes(d.getDay())) {
            if (od.start) {
              const dateStr = ymd(d)
              const exsStart = new Date(`${dateStr}T${od.start}:00`)
              const exsEnd = od.end ? new Date(`${dateStr}T${od.end}:00`) : new Date(exsStart.getTime() + 60*60*1000)
              exs.push({ start: exsStart, end: exsEnd })
            } else {
              const exsStart = new Date(d); exsStart.setHours(0,0,0,0)
              const exsEnd = new Date(d); exsEnd.setHours(23,59,59,999)
              exs.push({ start: exsStart, end: exsEnd })
            }
          }
        } else if (od.type === 'Monthly') {
          // apply if day of month matches od.date day or if od.date omitted, use base
          const odDay = od.date ? parseYmd(od.date) : null
          const match = odDay ? (odDay.getDate() === d.getDate()) : true
          if (match) {
            if (od.start) {
              const dateStr = ymd(d)
              const exsStart = new Date(`${dateStr}T${od.start}:00`)
              const exsEnd = od.end ? new Date(`${dateStr}T${od.end}:00`) : new Date(exsStart.getTime() + 60*60*1000)
              exs.push({ start: exsStart, end: exsEnd })
            } else {
              const exsStart = new Date(d); exsStart.setHours(0,0,0,0)
              const exsEnd = new Date(d); exsEnd.setHours(23,59,59,999)
              exs.push({ start: exsStart, end: exsEnd })
            }
          }
        }
      }
    }

    if (exs.length === 0) return [{ start: s, end: e }]
    // merge exclusion intervals
    exs.sort((a,b) => a.start.getTime() - b.start.getTime())
    const merged: Array<{ start: Date; end: Date }> = []
    for (const x of exs) {
      if (!merged.length) merged.push({ ...x })
      else {
        const last = merged[merged.length-1]
        if (x.start.getTime() <= last.end.getTime()) {
          if (x.end.getTime() > last.end.getTime()) last.end = x.end
        } else merged.push({ ...x })
      }
    }

    // subtract merged exclusions from [s,e)
    let remaining: Array<{ start: Date; end: Date }> = [{ start: s, end: e }]
    for (const ex of merged) {
      const next: Array<{ start: Date; end: Date }> = []
      for (const r of remaining) {
        // no overlap
        if (ex.end.getTime() <= r.start.getTime() || ex.start.getTime() >= r.end.getTime()) {
          next.push(r)
          continue
        }
        // overlap: left piece
        if (ex.start.getTime() > r.start.getTime()) {
          next.push({ start: r.start, end: new Date(Math.min(r.end.getTime(), ex.start.getTime())) })
        }
        // overlap: right piece
        if (ex.end.getTime() < r.end.getTime()) {
          next.push({ start: new Date(Math.max(r.start.getTime(), ex.end.getTime())), end: r.end })
        }
      }
      remaining = next
      if (!remaining.length) break
    }
    return remaining
  }
  const start = new Date(now)
  start.setHours(0,0,0,0)
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  const calendarRef = useRef<any>(null)
  const [navSelection, setNavSelection] = useState<'today' | 'tomorrow' | 'week' | 'month'>('today')
  // displayFormat removed: always use calendar TD for today/tomorrow

  const events = useMemo(() => {
    const ev: any[] = [];
    for (const h of (habits ?? [])) {
      if (h.type === 'avoid') continue;
      const timings = (h as any).timings ?? [];
      if (timings.length) {
        for (let ti = 0; ti < timings.length; ti++) {
          const t = timings[ti];
          const evIdBase = `${h.id}-${ti}`;
          if (t.type === 'Date' && t.date) {
            if (t.start) {
              ev.push({ title: h.name, start: `${t.date}T${t.start}:00`, end: t.end ? `${t.date}T${t.end}:00` : undefined, allDay: false, id: `${evIdBase}`, editable: true, className: 'vow-habit', extendedProps: { habitId: h.id, timingIndex: ti } });
            } else {
              ev.push({ title: h.name, start: t.date, allDay: true, id: evIdBase, editable: true, className: 'vow-habit', extendedProps: { habitId: h.id, timingIndex: ti } });
            }
          } else {
            // For recurring timings without a start time, render an all-day placeholder on base date
            const baseDate = t.date ?? h.dueDate ?? new Date().toISOString().slice(0,10);
            if (t.start) {
              // materialize next 7 occurrences (simple fallback)
              const base = parseYmd(t.date ?? h.dueDate ?? ymd(new Date())) ?? new Date();
              for (let d = 0; d < 7; d++) {
                const day = addDays(base, d);
                const dateS = ymd(day);
                ev.push({ title: h.name, start: `${dateS}T${t.start}:00`, end: t.end ? `${dateS}T${t.end}:00` : undefined, allDay: false, id: `${evIdBase}-${dateS}`, editable: true, className: 'vow-habit', extendedProps: { habitId: h.id, timingIndex: ti } });
              }
            } else {
              ev.push({ title: h.name, start: baseDate, allDay: true, id: evIdBase, editable: true, className: 'vow-habit', extendedProps: { habitId: h.id, timingIndex: ti } });
            }
          }
        }
        continue;
      }

      // no explicit timings: timed event if time exists, otherwise all-day
      const dateStr = h.dueDate ?? new Date().toISOString().slice(0,10);
      if ((h as any).time) {
        const startIso = `${dateStr}T${(h as any).time}:00`;
        const endIso = (h as any).endTime ? `${dateStr}T${(h as any).endTime}:00` : undefined;
        ev.push({ title: h.name, start: startIso, end: endIso, allDay: false, id: h.id, editable: true, className: 'vow-habit' });
      } else {
        ev.push({ title: h.name, start: dateStr, allDay: true, id: h.id, editable: true, className: 'vow-habit' });
      }
    }
    return ev;
  }, [habits]);

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
          const ext = (clickInfo.event as any).extendedProps ?? {}
          const habitId = ext.habitId ?? id
          if (onEventClick) onEventClick(habitId)
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
          // if this event came from a recurring rule, revert the change and notify parent
          const ext = (dropInfo.event as any).extendedProps ?? {}
          const habitId = ext.habitId ?? id
          const timingIndex = ext.timingIndex
          const isRecurring = (dropInfo.event.extendedProps && (dropInfo.event.extendedProps as any).isRecurring) || ((dropInfo.event as any)._def && (dropInfo.event as any)._def.recurringDef)
          if (isRecurring) {
            // undo the visual move
            try { dropInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr })
            return
          }
          if (onEventChange) onEventChange(habitId, { start: startStr, end: endStr })
        }}
        eventResize={(resizeInfo) => {
          const id = resizeInfo.event.id
          const startStr = (resizeInfo.event.startStr as string) ?? (resizeInfo.event.start ? resizeInfo.event.start.toISOString() : undefined)
          const endStr = (resizeInfo.event.endStr as string) ?? (resizeInfo.event.end ? resizeInfo.event.end.toISOString() : undefined)
          const ext = (resizeInfo.event as any).extendedProps ?? {}
          const habitId = ext.habitId ?? id
          const timingIndex = ext.timingIndex
          const isRecurring = (resizeInfo.event.extendedProps && (resizeInfo.event.extendedProps as any).isRecurring) || ((resizeInfo.event as any)._def && (resizeInfo.event as any)._def.recurringDef)
          if (isRecurring) {
            try { resizeInfo.revert(); } catch (e) { /* ignore */ }
            if (onRecurringAttempt) onRecurringAttempt(habitId, { start: startStr, end: endStr })
            return
          }
          if (onEventChange) onEventChange(habitId, { start: startStr, end: endStr })
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
