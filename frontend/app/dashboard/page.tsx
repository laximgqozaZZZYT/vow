"use client";

import { useState, useMemo, useEffect, useRef, useId } from "react";
import ActivityModal, { } from './components/activityModal';
import api from '../../lib/api';
import mermaid from 'mermaid'
import { formatTime24, formatDateTime24 } from '../../lib/format'
import { HabitModal, GoalModal } from "./components/modals";
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import FullCalendar from '@fullcalendar/react'
import EditLayoutModal from './components/editLayoutModal'
import StaticsSection from './components/staticsSection'
import DiarySection from './components/diarySection'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import dayGridPlugin from '@fullcalendar/daygrid'
import rrulePlugin from '@fullcalendar/rrule'
// FullCalendar CSS imports removed to avoid module resolution errors in this environment.
// If you want FullCalendar's default styles, consider adding them via a global CSS import
// or linking the CSS from a CDN in _document or app root.

// Mermaid can throw "Diagram flowchart-v2 already registered" if initialized multiple times.
// Guard initialization so it's done only once per page runtime.
let mermaidInitialized = false
function initMermaidOnce() {
  if (mermaidInitialized) return
  try {
    if ((mermaid as any)?.initialize) {
      mermaid.initialize({ startOnLoad: false })
    }
  } catch {
    // ignore
  }
  mermaidInitialized = true
}

type Goal = { id: string; name: string; details?: string; dueDate?: string | Date | null; parentId?: string | null; isCompleted?: boolean; createdAt: string; updatedAt: string };
type Habit = { id: string; goalId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; completed?: boolean; lastCompletedAt?: string; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; createdAt: string; updatedAt: string };

export default function DashboardPage() {
  const router = useRouter()
  const now = new Date().toISOString();
  const [goals, setGoals] = useState<Goal[]>([]);

  const [actorLabel, setActorLabel] = useState<string>('');
  const [isAuthed, setIsAuthed] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const [habits, setHabits] = useState<Habit[]>([]);

  // load data from API on mount
  useEffect(() => {
    (async () => {
      try {
        // If OAuth failed, Supabase will redirect back with ?error=...&error_description=...
        try {
          const url = new URL(window.location.href)
          const err = url.searchParams.get('error')
          const desc = url.searchParams.get('error_description')
          if (err) {
            setAuthError(desc ? `${err}: ${desc}` : err)
          } else {
            setAuthError(null)
          }
        } catch {}

        // If logged in with Supabase, attach Bearer and merge guest data once.
        try {
          if (supabase) {
            const { data } = await supabase.auth.getSession()
            const accessToken = data?.session?.access_token ?? null
            setIsAuthed(!!accessToken)
            ;(api as any).setBearerToken?.(accessToken)
            if (accessToken) {
              // Best-effort claim; it will no-op if no guest session.
              try { await (api as any).claim?.() } catch {}
            }
            if (!accessToken) {
              ;(api as any).setBearerToken?.(null)
            }
          }
        } catch {}

        try {
          const me = await api.me();
          const a = (me as any)?.actor;
          if (a?.type === 'user') setActorLabel(`user:${a.id}`)
          else if (a?.type === 'guest') setActorLabel(`guest:${a.id}`)
          else setActorLabel('')
        } catch {}

        const gs = await api.getGoals();
        setGoals(gs || []);
        const hs = await api.getHabits();
        setHabits(hs || []);
        const acts = await api.getActivities();
        setActivities(acts || []);
        const layout = await api.getLayout();
        if (layout && Array.isArray(layout.sections)) setPageSections(layout.sections as any);
      } catch (e) {
        console.error('Failed to load initial data', e);
      }
    })()
  }, [])

  // Keep header auth state in sync after OAuth redirect/login.
  useEffect(() => {
    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      const token = session?.access_token ?? null
      setIsAuthed(!!token)
      try {
        ;(api as any).setBearerToken?.(token)
      } catch {}
      if (token) {
        // Best-effort claim; safe to call multiple times.
        try { await (api as any).claim?.() } catch {}
      }
    })

    return () => {
      try { sub?.subscription?.unsubscribe() } catch {}
    }
  }, [])

  async function handleLogout() {
    try {
      await supabase?.auth.signOut()
    } catch {}
    try {
      ;(api as any).setBearerToken?.(null)
    } catch {}
    setIsAuthed(false)

    // Move user to login after logout
    try {
      router.push('/login')
    } catch {}

    // Best-effort refresh of actor label
    try {
      const me = await api.me();
      const a = (me as any)?.actor;
      if (a?.type === 'user') setActorLabel(`user:${a.id}`)
      else if (a?.type === 'guest') setActorLabel(`guest:${a.id}`)
      else setActorLabel('')
    } catch {}
  }

  const [selectedGoal, setSelectedGoal] = useState<string | null>(
    goals[0]?.id ?? null
  );
  const [showLeftPane, setShowLeftPane] = useState(false);

  const [openNewCategory, setOpenNewCategory] = useState(false);
  const [openNewHabit, setOpenNewHabit] = useState(false);
  const [openHabitModal, setOpenHabitModal] = useState(false);
  
  const [editLayoutOpen, setEditLayoutOpen] = useState(false);
  type SectionId = 'next' | 'activity' | 'calendar' | 'statics' // | 'diary' - 一時的に無効化
  const [pageSections, setPageSections] = useState<SectionId[]>(['next','activity','calendar','statics']) // 'diary'を削除

  // Hydration safety: only read localStorage after mount, otherwise server/client HTML can diverge.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('pageSections')
      if (raw) setPageSections(JSON.parse(raw) as SectionId[])
    } catch {}
  }, [])

  useEffect(() => { try { window.localStorage.setItem('pageSections', JSON.stringify(pageSections)) } catch(e){} }, [pageSections])
  type ActivityKind = 'start' | 'complete' | 'skip' | 'pause'
  type Activity = { id: string; kind: ActivityKind; habitId: string; habitName: string; timestamp: string; amount?: number; prevCount?: number; newCount?: number; durationSeconds?: number }
  const [activities, setActivities] = useState<Activity[]>([]);
  const [openActivityModal, setOpenActivityModal] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [starts, setStarts] = useState<Record<string, { ts: string; timeoutId?: number }>>({});
  // pausedLoads stores the amount of load already completed for the current count when Pause is pressed
  const [pausedLoads, setPausedLoads] = useState<Record<string, number>>({});
  const [recurringRequest, setRecurringRequest] = useState<null | { habitId: string; start?: string; end?: string }>(null);
  // frames feature removed: no openNewFrame state
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [newHabitInitial, setNewHabitInitial] = useState<{ date?: string; time?: string; endTime?: string } | null>(null);
  const [newHabitInitialType, setNewHabitInitialType] = useState<"do" | "avoid" | undefined>(undefined)
  // frames removed

  // Basic top-right auth link
  // (File is big; we inject UI near the top via a small fixed header block)

  const selectedHabit = habits.find((h) => h.id === selectedHabitId) ?? null;

  // Update habit when calendar event is moved/resized
  async function handleEventChange(
    habitId: string,
    updated: { start?: string; end?: string; timingIndex?: number }
  ) {
    const startIso = updated.start
    const endIso = updated.end
    const newDue = startIso ? startIso.slice(0, 10) : undefined
    const newTime = startIso && startIso.length > 10 ? startIso.slice(11, 16) : undefined
    const newEnd = endIso && endIso.length > 10 ? endIso.slice(11, 16) : undefined
    const timingIndex = typeof updated.timingIndex === 'number' ? updated.timingIndex : undefined

    const prev = habits.find(h => h.id === habitId)
    if (!prev) return

    // Optimistic UI update
    setHabits((s) => s.map(h => {
      if (h.id !== habitId) return h;
      const now = new Date().toISOString()
      const next: any = {
        ...h,
        dueDate: newDue ?? h.dueDate,
        time: newTime ?? h.time,
        endTime: newEnd ?? h.endTime,
        updatedAt: now,
      }

      // Keep timings in sync if this event corresponds to a timing row
      if (typeof timingIndex === 'number') {
        const timings = Array.isArray((h as any).timings) ? (h as any).timings : []
        if (timings[timingIndex]) {
          const t = { ...timings[timingIndex] }
          if (newDue) t.date = newDue
          if (newTime !== undefined) t.start = newTime
          if (newEnd !== undefined) t.end = newEnd
          const newTimings = [...timings]
          newTimings[timingIndex] = t
          next.timings = newTimings
        }
      }
      return next
    }))

    // Persist to backend
    try {
      const payload: any = {
        ...(newDue ? { dueDate: newDue } : {}),
        ...(newTime !== undefined ? { time: newTime } : {}),
        ...(newEnd !== undefined ? { endTime: newEnd } : {}),
      }
      if (typeof timingIndex === 'number') payload.timingIndex = timingIndex
      const saved = await api.updateHabit(habitId, payload)
      setHabits((s) => s.map(h => h.id === habitId ? saved : h))
    } catch (e) {
      console.error(e)
      // revert to previous state if persistence fails
      setHabits((s) => s.map(h => h.id === habitId ? prev : h))
    }
  }

  // frame handlers removed

  async function createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    try {
      const g = await api.createGoal(payload);
      setGoals((s) => [...s, g]);
      setSelectedGoal(g.id);
    } catch (e) { console.error(e) }
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

  async function createHabit(payload: { name: string; goalId?: string; type: "do" | "avoid"; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; timings?: any[]; allDay?: boolean; notes?: string; workloadUnit?: string; workloadTotal?: number; workloadPerCount?: number }) {
    try {
      const h = await api.createHabit(payload);
      setHabits((s) => [...s, h]);
    } catch (e) { console.error(e) }
  }

  

  function handleComplete(habitId: string) {
    const now = new Date().toISOString();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
  const basePerCount = (habit as any).workloadPerCount ?? 1;
  const paused = pausedLoads[habitId] ?? 0;
  // amount to add for this completion = basePerCount - paused (but at least 0)
  const increment = Math.max(0, basePerCount - paused);
  const prev = habit.count ?? 0;
  const newCount = prev + increment;
    const total = (habit as any).workloadTotal ?? habit.must ?? 0;

    // update habit
    setHabits(s => s.map(h => h.id === habitId ? ({ ...h, count: newCount, completed: total > 0 ? (newCount >= total) : true, lastCompletedAt: now, updatedAt: now }) : h));

    // if there's a start recorded for this habit, convert that start to a complete with duration
    const start = starts[habitId];
    if (start) {
      const durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(start.ts).getTime()) / 1000));
      (async () => {
        const idx = activities.findIndex(a => a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts);
        if (idx !== -1) {
          const old = activities[idx];
          const prevCountVal = (typeof old.prevCount === 'number') ? old.prevCount : (typeof old.newCount === 'number' ? old.newCount : (habit.count ?? 0));
          const updatedAct: Activity = { ...old, kind: 'complete', amount: increment, prevCount: prevCountVal, newCount, durationSeconds };
          try {
            if (old.id && !String(old.id).startsWith('a')) {
              const u = await api.updateActivity(old.id, updatedAct);
              setActivities(acts => { const copy = [...acts]; const i = copy.findIndex(x => x.id === old.id); if (i !== -1) { copy[i] = u } return copy });
            } else {
              const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
              setActivities(acts => { const copy = acts.filter(a => !(a.habitId === habitId && a.kind === 'start' && a.timestamp === start.ts)); return [created, ...copy] });
            }
          } catch (e) { console.error(e) }
        } else {
          try {
            const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount, durationSeconds });
            setActivities(acts => [created, ...acts]);
          } catch (e) { console.error(e) }
        }
      })();
      // clear start timer and state
      const to = start.timeoutId;
      if (typeof to === 'number') clearTimeout(to);
      setStarts(s => { const c = { ...s }; delete c[habitId]; return c; });
      return;
    }

  // no start: create a standalone complete activity
  // Persist the completion so it survives reload.
  (async () => {
    try {
      const created = await api.createActivity({ kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount });
      setActivities(a => [created, ...a]);
    } catch (e) {
      console.error(e);
      // fallback to local
      setActivities(a => [{ id: `a${Date.now()}`, kind: 'complete', habitId, habitName: habit.name, timestamp: now, amount: increment, prevCount: prev, newCount }, ...a]);
    }
  })();
  // clear pausedLoads for this habit (we consumed it)
  setPausedLoads(s => { const c = { ...s }; delete c[habitId]; return c; });
  }

  function handleStart(habitId: string) {
    const now = new Date().toISOString();
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    // if already started, treat as complete
    if (starts[habitId]) {
      handleComplete(habitId);
      return;
    }
    // schedule skip after 24h
    const timeoutId = window.setTimeout(() => {
      setStarts(s => {
        if (!s[habitId]) return s;
        const ts = new Date().toISOString();
        // Persist skip; fall back to local if backend is unreachable.
        (async () => {
          try {
            const created = await api.createActivity({ kind: 'skip', habitId, habitName: habit.name, timestamp: ts });
            setActivities(a => [created, ...a]);
          } catch (e) {
            console.error(e);
            setActivities(a => [{ id: `a${Date.now()}`, kind: 'skip', habitId, habitName: habit.name, timestamp: ts }, ...a]);
          }
        })();
        const copy = { ...s }; delete copy[habitId]; return copy;
      });
    }, 24 * 60 * 60 * 1000);

    setStarts(s => ({ ...s, [habitId]: { ts: now, timeoutId } }));
    (async () => {
      try {
        const created = await api.createActivity({ kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 });
        setActivities(a => [created, ...a]);
      } catch (e) {
        // fallback to local
        setActivities(a => [{ id: `a${Date.now()}`, kind: 'start', habitId, habitName: habit.name, timestamp: now, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 }, ...a]);
      }
    })();
  }

  function handlePause(habitId: string) {
    // open Activity modal in pause mode
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const now = new Date().toISOString();
    const localId = `a${Date.now()}`;
    const placeholder: Activity = { id: localId, kind: 'pause', habitId, habitName: habit.name, timestamp: now, amount: 0, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 };
    // Create the pause on backend first so any edits persist across reload.
    (async () => {
      try {
        const created = await api.createActivity({ kind: 'pause', habitId, habitName: habit.name, timestamp: now, amount: 0, prevCount: habit.count ?? 0, newCount: habit.count ?? 0 });
        setActivities(a => [created, ...a]);
        setEditingActivityId(created.id);
        setOpenActivityModal(true);
      } catch (e) {
        console.error(e);
        // fallback to local placeholder
        setActivities(a => [placeholder, ...a]);
        setEditingActivityId(localId);
        setOpenActivityModal(true);
      }
    })();
  }

  function openEditActivity(activityId: string) {
    setEditingActivityId(activityId);
    setOpenActivityModal(true);
  }

  function propagateActivityChanges(updated: Activity) {
    // update the specific activity
    setActivities(prev => {
      const idx = prev.findIndex(a => a.id === updated.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = updated;
      // propagate to subsequent activities for the same habit: adjust their prevCount/newCount and duration if needed
      // We'll recompute counts for following activities by replaying from the first activity's prevCount
      let baseCount = updated.prevCount ?? 0;
      for (let i = idx; i < copy.length; i++) {
        const a = copy[i];
        if (a.habitId !== updated.habitId) continue;
        if (i === idx) {
          // already set
          baseCount = (typeof a.newCount === 'number') ? a.newCount : baseCount;
          continue;
        }
        // recompute this activity based on its kind and amount
        if (a.kind === 'pause') {
          // pause doesn't change counts but stores paused load
          // keep prevCount as baseCount
          a.prevCount = baseCount;
          a.newCount = baseCount;
        } else if (a.kind === 'complete') {
          const per = (habits.find(h => h.id === a.habitId) as any)?.workloadPerCount ?? 1;
          // if a has amount specified, use it; else use per
          const amt = (typeof a.amount === 'number' ? a.amount : per);
          a.prevCount = baseCount;
          a.newCount = baseCount + amt;
          baseCount = (typeof a.newCount === 'number') ? a.newCount : baseCount;
        } else if (a.kind === 'start') {
          a.prevCount = baseCount;
          a.newCount = baseCount;
        } else if (a.kind === 'skip') {
          a.prevCount = baseCount;
          a.newCount = baseCount;
        }
      }
      // after propagation, update the habit's stored count to the most recent newCount for this habit (if any)
      const mostRecent = copy.find(x => x.habitId === updated.habitId && typeof x.newCount === 'number');
      const latestCount = mostRecent ? (mostRecent.newCount as number) : undefined;
      if (typeof latestCount === 'number') {
        setHabits(hs => hs.map(h => h.id === updated.habitId ? { ...h, count: latestCount, updatedAt: new Date().toISOString() } : h));
      }

      // if the updated activity was a pause, update pausedLoads for that habit
      if (updated.kind === 'pause') {
        setPausedLoads(s => ({ ...s, [updated.habitId]: updated.amount ?? 0 }));
      }

      return copy;
    });
  }

  function handleDeleteActivity(activityId: string) {
    const act = activities.find(a => a.id === activityId);
    if (!act) return;
    const prevCount = act.prevCount ?? 0;
    // rollback habit count to prevCount and adjust completed flag
    setHabits(s => s.map(h => {
      if (h.id !== act.habitId) return h;
      const total = (h as any).workloadTotal ?? h.must ?? 0;
      const completed = (total > 0) ? (prevCount >= total) : false;
      return { ...h, count: prevCount, completed, updatedAt: new Date().toISOString() };
    }));
    // remove activity (and delete on backend if persisted)
    if (!String(activityId).startsWith('a')) {
      (async () => { try { await api.deleteActivity(activityId); } catch(e) { console.error(e) } })();
    }
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
    // persist
    (async () => { try { await api.updateGoal(updated.id, updated) } catch(e) { console.error(e) } })()
  }

  function deleteGoal(id: string) {
    // remove the goal and any child goals (simple approach: filter by id)
    setGoals((s) => s.filter(g => g.id !== id));
    // also reassign or remove habits under that goal: here we remove habits belonging to that goal
    setHabits((s) => s.filter(h => h.goalId !== id));
    (async () => { try { await api.deleteGoal(id) } catch (e) { console.error(e) } })()
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

  // determine effective completion for a goal: if the goal or any ancestor is completed
  function effectiveGoalCompleted(goalId: string) {
    let g: Goal | undefined = goalsById[goalId]
    while (g) {
      if (g.isCompleted) return true
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

  // Collect descendant goal ids including self.
  function collectGoalSubtreeIds(rootId: string) {
    const ids: string[] = []
    const stack: string[] = [rootId]
    const seen = new Set<string>()
    while (stack.length) {
      const id = stack.pop()!
      if (seen.has(id)) continue
      seen.add(id)
      ids.push(id)
      for (const g of goals) {
        if (g.parentId === id) stack.push(g.id)
      }
    }
    return ids
  }

  async function completeGoalCascade(goalId: string) {
    // Optimistically update local state first.
    const subtree = new Set(collectGoalSubtreeIds(goalId))
    const now = new Date().toISOString()
    setGoals((s) => s.map(g => subtree.has(g.id) ? ({ ...g, isCompleted: true, updatedAt: now } as any) : g))
    // Treat descendant habits as "not to be done": inactive + completed.
    setHabits((s) => s.map(h => subtree.has(h.goalId) ? ({ ...h, active: false, completed: true, updatedAt: now } as any) : h))

    // Persist
    try {
      await api.updateGoal(goalId, { isCompleted: true, cascade: true })
    } catch (e) {
      // Surface backend error details to make debugging actionable.
      const anyErr: any = e
      const details = {
        name: anyErr?.name,
        message: anyErr?.message ?? String(anyErr),
        url: anyErr?.url,
        status: anyErr?.status,
        body: anyErr?.body,
        keys: anyErr && typeof anyErr === 'object' ? Object.keys(anyErr) : undefined,
      }
      console.error('[completeGoalCascade] error', details)
      // If persistence fails, we keep optimistic state; user can refresh.
    }
  }

  // Recursive goal node renderer (renders up to 3 levels: root, child, grandchild)
  const GoalNode = ({ goal, depth = 1 }: { goal: Goal; depth?: number }) => {
    const isOpen = !!openGoals[goal.id]
    const kids = childrenOf(goal.id)
    const myHabits = habits.filter(h => h.goalId === goal.id)
    const goalCompleted = effectiveGoalCompleted(goal.id)

    return (
      <div key={goal.id}>
        <div className={`flex items-center justify-between cursor-pointer rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/5 ${selectedGoal === goal.id ? 'bg-zinc-100 dark:bg-white/5' : ''}`}>
          <div className="flex items-center gap-2">
            <button onClick={() => { toggleGoal(goal.id); setSelectedGoal(goal.id); }} className="inline-block w-3">{isOpen ? '▾' : '▸'}</button>
            <button onClick={() => { setEditingGoalId(goal.id); setOpenGoalModal(true); }} className={`text-sm font-medium text-left ${goalCompleted ? 'line-through text-zinc-400' : ''}`}>{goal.name}</button>
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
                    className={`flex items-center justify-between rounded px-2 py-1 text-sm ${(h.completed || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="truncate">{h.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button title="Start" onClick={(e) => { e.stopPropagation(); handleStart(h.id) }} className="text-blue-600 hover:bg-blue-50 rounded px-2 py-1">▶️</button>
                      <button title="Pause" onClick={(e) => { e.stopPropagation(); handlePause(h.id) }} className="text-amber-600 hover:bg-amber-50 rounded px-2 py-1">⏸️</button>
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
                    className={`flex items-center justify-between rounded px-2 py-1 text-sm ${(h.completed || goalCompleted || !h.active) ? 'line-through text-zinc-400' : 'text-zinc-700'} hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/5 cursor-pointer`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span>📄</span>
                      <span className="truncate">{h.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button title="Start" onClick={(e) => { e.stopPropagation(); handleStart(h.id) }} className="text-blue-600 hover:bg-blue-50 rounded px-2 py-1">▶️</button>
                      <button title="Pause" onClick={(e) => { e.stopPropagation(); handlePause(h.id) }} className="text-amber-600 hover:bg-amber-50 rounded px-2 py-1">⏸️</button>
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
      {/* Fixed header (always on top) */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-[#071013]/90">
        <div className="flex h-14 items-center justify-between px-2 sm:px-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeftPane((s) => !s)}
              aria-label="Toggle menu"
              className="rounded px-2 py-1 text-2xl leading-none hover:bg-zinc-100 dark:hover:bg-white/10"
            >
              ☰
            </button>
            <div className="text-lg font-bold tracking-wide">VOW</div>
          </div>

          <div className="flex items-center gap-2">
            {actorLabel && (
              <div className="hidden text-xs text-zinc-500 sm:block">{actorLabel}</div>
            )}
            {authError && (
              <div className="hidden max-w-[420px] truncate text-xs text-amber-700 sm:block dark:text-amber-300" title={authError}>
                {authError}
              </div>
            )}
            {isAuthed ? (
              <button
                onClick={handleLogout}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-950/35"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-white/10"
              >
                Login
              </Link>
            )}
            <button
              onClick={() => setEditLayoutOpen(true)}
              className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-slate-700 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
            >
              Editor Layout
            </button>
          </div>
        </div>
      </header>

      {/* Left pane */}
      {showLeftPane && (
        <aside className="fixed left-0 top-14 w-80 h-[calc(100vh-3.5rem)] border-r border-zinc-200 bg-white dark:bg-[#071013] p-3 z-40">
          <div className="mb-3 flex items-center justify-between">
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
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              setNewHabitInitial({ date: today })
              setOpenNewHabit(true)
            }}
          >
            + New Habit
          </button>
            {/* Frame feature removed */}
        </div>
  </aside>
  )}

  {/* Right pane */}
  <main className={`flex-1 pt-20 p-8 ${showLeftPane ? 'ml-80' : ''}`}>

        <div className="mt-6 grid grid-cols-1 gap-4">
          {pageSections.map(sec => (
            sec === 'next' ? (
              <section key="next" className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
                <div className="flex justify-between items-start">
                  <h2 className="mb-3 text-lg font-medium">Next</h2>
                </div>
                {/* Next section content (same as before) */}
                {(() => {
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

                  if (pick.length === 0) return <div className="text-sm text-zinc-500">No habits starting in the next 24 hours</div>;

                  return (
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
                                onClick={(e) => { e.stopPropagation(); handleStart(c.h.id) }}
                                className="rounded px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-white/10"
                              >
                                ▶️
                              </button>
                              <button
                                title="Pause"
                                onClick={(e) => { e.stopPropagation(); handlePause(c.h.id) }}
                                className="rounded px-2 py-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-white/10"
                              >
                                ⏸️
                              </button>
                              <button
                                title="Done"
                                onClick={(e) => { e.stopPropagation(); handleComplete(c.h.id) }}
                                className="rounded px-2 py-1 text-green-600 hover:bg-green-50 dark:hover:bg-white/10"
                              >
                                ✅
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </section>
            ) : sec === 'activity' ? (
              <section key="activity" className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b] mt-4">
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
                          <button className="text-sm text-blue-600" onClick={() => openEditActivity(act.id)}>Edit</button>
                          <button className="text-sm text-red-600" onClick={() => handleDeleteActivity(act.id)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : sec === 'calendar' ? (
              <FullCalendarWrapper
                key="calendar"
                habits={habits}
                goals={goals}
                onEventClick={(id: string) => { setSelectedHabitId(id); setOpenHabitModal(true); }}
                onSlotSelect={(isoDate: string, time?: string, endTime?: string) => {
                  // isoDate may be a YYYY-MM-DD or full ISO; normalize to YYYY-MM-DD.
                  const dateOnly = (isoDate || '').slice(0, 10)
                  setNewHabitInitial({ date: dateOnly, time, endTime });
                  setOpenNewHabit(true)
                }}
                onEventChange={(id: string, updated) => handleEventChange(id, updated)}
                onRecurringAttempt={(habitId: string, updated) => { setRecurringRequest({ habitId, start: updated.start, end: updated.end }) }}
              />
            ) : sec === 'statics' ? (
              <StaticsSection key="statics" habits={habits as any} activities={activities as any} goals={goals as any} />
            // ) : sec === 'diary' ? (
            //   <DiarySection key="diary" goals={goals as any} habits={habits as any} />
            ) : null
          ))}
        </div>
        
      </main>

      <GoalModal
        open={openNewCategory}
        onClose={() => setOpenNewCategory(false)}
        goal={null}
        onCreate={(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => createGoal(payload)}
        goals={goals}
      />

      

      <EditLayoutModal
        open={editLayoutOpen}
        onClose={() => setEditLayoutOpen(false)}
        sections={pageSections}
        onChange={async (s: any) => {
          setPageSections(s)
          try { await (api as any).setLayout?.(s) } catch (e) { console.error('Failed to persist layout', e) }
        }}
        onAdd={(id: any) => setPageSections(ps => ps.includes(id) ? ps : [...ps, id])}
        onDelete={(id: any) => setPageSections(ps => ps.filter(x => x !== id))}
      />

      <GoalModal
        open={openGoalModal}
        onClose={() => { setOpenGoalModal(false); setEditingGoalId(null); }}
        goal={editingGoal}
        onUpdate={(g) => updateGoal(g)}
        onDelete={(id) => deleteGoal(id)}
        onComplete={(id) => completeGoalCascade(id)}
        goals={goals}
      />

      {/* NewHabit: creation modal (Frame feature removed) */}
      <HabitModal
        key={selectedHabit?.id ?? 'none'}
        open={openHabitModal}
        onClose={() => { setOpenHabitModal(false); setSelectedHabitId(null); }}
        habit={selectedHabit}
        onUpdate={async (updated) => {
          try { const u = await api.updateHabit(updated.id, updated); setHabits((s) => s.map(h => h.id === updated.id ? u : h)) } catch(e) { console.error(e) }
        }}
        onDelete={async (id) => { try { await api.deleteHabit(id); setHabits((s) => s.filter(h => h.id !== id)) } catch(e) { console.error(e) } }}
        categories={goals}
      />

      {/* Creation modal: reuse HabitModal for New Habit */}
      <HabitModal
        open={openNewHabit}
        onClose={() => { setOpenNewHabit(false); setNewHabitInitial(null); setNewHabitInitialType(undefined); }}
        habit={null}
        initial={{ date: newHabitInitial?.date, time: newHabitInitial?.time, endTime: newHabitInitial?.endTime, type: newHabitInitialType }}
        onCreate={(payload) => {
          createHabit(payload as any)
        }}
        categories={goals}
      />

      <ActivityModal
        open={openActivityModal}
        onClose={() => { setOpenActivityModal(false); setEditingActivityId(null); }}
        initial={activities.find(a => a.id === editingActivityId) ?? null}
        onSave={(updated) => {
          propagateActivityChanges(updated as any);
          setOpenActivityModal(false);
          setEditingActivityId(null);
        }}
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

function FullCalendarWrapper({ habits, goals, onEventClick, onSlotSelect, onEventChange, onRecurringAttempt }: { habits: Habit[]; goals: Goal[]; onEventClick?: (id: string) => void; onSlotSelect?: (isoDate: string, time?: string, endTime?: string) => void; onEventChange?: (id: string, updated: { start?: string; end?: string; timingIndex?: number }) => void; onRecurringAttempt?: (habitId: string, updated: { start?: string; end?: string; timingIndex?: number }) => void }) {
  const now = new Date()
  // When a habit has recurring timings but no explicit on-disk expansion, we need to materialize
  // occurrences for the calendar UI.
  //
  // Requirement:
  // - If the habit belongs to a goal with dueDate: expand up to that dueDate.
  // - If no goal dueDate: expand indefinitely (we approximate with a long horizon).
  const INDEFINITE_HORIZON_DAYS = 365 * 5
  function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x }
  function parseYmd(s?: string) { if (!s) return undefined; const parts = s.split('-').map(x => Number(x)); if (parts.length>=3 && !Number.isNaN(parts[0])) return new Date(parts[0], parts[1]-1, parts[2]); const dd = new Date(s); return isNaN(dd.getTime()) ? undefined : dd }

  function getGoalDueDate(goalId: string): Date | undefined {
    const g = (goals ?? []).find((x) => x.id === goalId)
    return g?.dueDate ? parseYmd(String(g.dueDate)) : undefined
  }

  function computeExpandDays(base: Date, goalDue?: Date): number {
    const horizon = goalDue ?? addDays(base, INDEFINITE_HORIZON_DAYS)
    const endDay = new Date(horizon)
    endDay.setHours(0, 0, 0, 0)
    const baseDay = new Date(base)
    baseDay.setHours(0, 0, 0, 0)
    const days = Math.ceil((endDay.getTime() - baseDay.getTime()) / (24 * 3600 * 1000))
    return Math.max(1, days + 1)
  }

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

  function scrollToNowCenter() {
    const cal = calendarRef.current?.getApi?.()
    if (!cal) return
    try {
      const now = new Date()
      // Center: scroll a few hours earlier so "now" is around the middle.
      const seconds = Math.max(0, now.getHours() * 3600 + now.getMinutes() * 60 - 3 * 3600)
      cal.scrollToTime(seconds)
    } catch {
      // ignore
    }
  }

  // Note: scrollToTime only works after the timeGrid view has mounted.
  // We trigger the scroll from FullCalendar lifecycle callbacks (below),
  // rather than relying on a bare setTimeout(0).

  const events = useMemo(() => {
    const ev: any[] = [];
    const goalsById = Object.fromEntries((goals ?? []).map(g => [g.id, g])) as Record<string, Goal>
    const goalCompleted = (goalId: string) => {
      let g: Goal | undefined = goalsById[goalId]
      while (g) {
        if (g.isCompleted) return true
        g = g.parentId ? goalsById[g.parentId] : undefined
      }
      return false
    }
    for (const h of (habits ?? [])) {
      // If the habit is inactive/completed, or its goal (or any ancestor) is completed,
      // treat it as "not to be done" and exclude it from the calendar.
      if (!h.active) continue;
      if (h.completed) continue;
      if (goalCompleted(h.goalId)) continue;
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
              // Expand occurrences until the goal dueDate; if no dueDate, use a long horizon.
              const base = parseYmd(t.date ?? h.dueDate ?? ymd(new Date())) ?? new Date();
              const goalDue = getGoalDueDate(h.goalId)
              const expandDays = computeExpandDays(base, goalDue)
              for (let d = 0; d < expandDays; d++) {
                const day = addDays(base, d)
                const dateS = ymd(day)
                // Respect simple timing types (Daily/Weekly/Monthly); Date is handled earlier.
                if (t.type === 'Weekly') {
                  let weekdays: number[] | null = null
                  if (t.cron && String(t.cron).startsWith('WEEKDAYS:')) {
                    weekdays = (t.cron.split(':')[1] || '').split(',').map((x: string) => Number(x)).filter((n: number) => !Number.isNaN(n))
                  }
                  if (weekdays && !weekdays.includes(day.getDay())) continue
                }
                if (t.type === 'Monthly') {
                  const ref = parseYmd(t.date)
                  if (ref && ref.getDate() !== day.getDate()) continue
                }
                ev.push({ title: h.name, start: `${dateS}T${t.start}:00`, end: t.end ? `${dateS}T${t.end}:00` : undefined, allDay: false, id: `${evIdBase}-${dateS}`, editable: true, className: 'vow-habit', extendedProps: { habitId: h.id, timingIndex: ti } })
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
  }, [habits, goals]);

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
                // after the view/date updates, scroll the day view to center around now
                window.setTimeout(() => scrollToNowCenter(), 50)
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
        nowIndicator={true}
        viewDidMount={() => {
          // Run once the view is mounted; for initial load with 'today', this ensures scroll works.
          if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0)
        }}
        datesSet={() => {
          // When navigating, the view can re-render; keep 'today' centered on now.
          if (navSelection === 'today') window.setTimeout(() => scrollToNowCenter(), 0)
        }}
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
        // Force 24-hour times in both the axis and the event time labels
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        select={(selectionInfo) => {
          // selectionInfo provides both start and end for range selections
          const iso = selectionInfo.startStr?.slice(0,10) ?? selectionInfo.start?.toISOString().slice(0,10)
          const startTime = selectionInfo.startStr && selectionInfo.startStr.length > 10 ? selectionInfo.startStr.slice(11,16) : undefined
          const endSrc = (selectionInfo.endStr && selectionInfo.endStr.length > 10)
            ? selectionInfo.endStr
            : (selectionInfo.end ? selectionInfo.end.toISOString() : undefined)
          const endTime = endSrc && endSrc.length > 10 ? endSrc.slice(11,16) : undefined
          if (onSlotSelect && iso) onSlotSelect(iso, startTime, endTime)
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
          if (onSlotSelect && iso) onSlotSelect(iso, time, undefined)
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
          if (onEventChange) onEventChange(habitId, { start: startStr, end: endStr, timingIndex })
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
          if (onEventChange) onEventChange(habitId, { start: startStr, end: endStr, timingIndex })
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

    const formatErr = (e: any) => {
      if (!e) return 'Unknown error'
      if (typeof e === 'string') return e
      if (e instanceof Error) return e.stack || e.message
      if (typeof e?.message === 'string') return e.message
      try { return JSON.stringify(e, null, 2) } catch { return String(e) }
    }

    const render = async () => {
      try {
        initMermaidOnce()

        // Render using mermaid.run() (v10+ recommended) to avoid mermaidAPI.render quirks.
        // We set the graph source into a <pre class="mermaid"> and let mermaid transform it.
        if (cancelled) return
        const safe = graph.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        el.innerHTML = `<pre class="mermaid">${safe}</pre>`

        const run = (mermaid as any)?.run
        if (typeof run !== 'function') {
          // Fallback: show plain text if run() isn't available
          el.innerText = graph
          return
        }

        // Wait a tick to ensure the element is in the DOM and layout is stable.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        if (cancelled) return

        // Render only the `.mermaid` node(s) inside this container.
        const nodes = Array.from(el.querySelectorAll('.mermaid')).filter(Boolean)
        if (!nodes.length) {
          el.innerText = graph
          return
        }

        try {
          await run({ nodes })
        } catch (e) {
          // Some versions throw internal DOM errors (e.g. appendChild on null).
          // Fallback to render() if available.
          const api = (mermaid as any)?.mermaidAPI || (mermaid as any)
          if (api?.render) {
            const renderId = `${id}-svg`
            const res = api.render(renderId, graph)
            const out = res && typeof (res as any).then === 'function' ? await res : res
            if (cancelled) return
            if (typeof out === 'string') el.innerHTML = out
            else if (out && typeof out === 'object' && typeof (out as any).svg === 'string') el.innerHTML = (out as any).svg
            else el.innerText = String(out)
          } else {
            throw e
          }
        }
      } catch (e: any) {
        el.innerText = formatErr(e)
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
