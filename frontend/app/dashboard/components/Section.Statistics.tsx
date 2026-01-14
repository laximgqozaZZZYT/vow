"use client"

import React from 'react'
import GoalMermaid from './Widget.GoalDiagram'
import MultiEventChart from './Widget.MultiEventChart'
import HeatmapWidget from './Widget.Heatmap'
import type { Goal as SharedGoal, Habit, Activity } from '../types'
import { useHandedness } from '../contexts/HandednessContext'

type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly'
type Timing = {
  id?: string
  type: TimingType
  date?: string
  start?: string
  end?: string
  cron?: string
}

type Goal = {
  id: string
  name: string
  isCompleted?: boolean | null
  createdAt?: string | null
  updatedAt?: string | null
  parentId?: string | null
}

type Point = { date: string; value: number }

type EventPoint = {
  habitId: string
  ts: number
  iso: string
  kind: 'pause' | 'complete'

  // workload numbers
  workloadDelta: number
  workloadCumulative: number
  workloadTotal: number | null
  progressDelta: number
  progressCumulative: number
  workloadUnit: string
}

type RangeKey = 'auto' | '24h' | '7d' | '1mo' | '1y'

function isSameLocalDay(aTs: number, bTs: number) {
  const a = new Date(aTs)
  const b = new Date(bTs)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function safePct(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0
  return Math.max(0, Math.min(1, n / d))
}

function isoDay(ts: string) {
  try { return new Date(ts).toISOString().slice(0, 10) } catch { return '' }
}

function buildDailyCountSeries(activities: Activity[], habitId: string): Point[] {
  const map = new Map<string, number>()

  for (const a of activities) {
    if (a.habitId !== habitId || !a.timestamp) continue
    const d = isoDay(a.timestamp)
    if (!d) continue

    // Prefer explicit amount (if provided), otherwise count events.
    const delta = typeof a.amount === 'number' ? a.amount : 1
    map.set(d, (map.get(d) ?? 0) + delta)
  }

  const points = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }))

  return points
}

function safeTs(iso: string | undefined): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

function getRangeStartTs(range: RangeKey): number {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (range === 'auto') return 0
  if (range === '24h') return now - day
  if (range === '7d') return now - 7 * day
  if (range === '1mo') return now - 30 * day
  if (range === '1y') return now - 365 * day
  return 0
}

function computeRangeWindow(range: RangeKey, nowTs: number): { fromTs: number; untilTs: number } {
  // Returns a concrete window for preset buttons so we can fill [from]/[until].
  const d = new Date(nowTs)

  if (range === 'auto') {
    d.setHours(0, 0, 0, 0)
    const fromTs = d.getTime()
    const untilTs = fromTs + (24 * 60 - 1) * 60_000 // 23:59
    return { fromTs, untilTs }
  }

  if (range === '24h') return { fromTs: nowTs - 24 * 60 * 60_000, untilTs: nowTs }
  if (range === '7d') return { fromTs: nowTs - 7 * 24 * 60 * 60_000, untilTs: nowTs }
  if (range === '1mo') return { fromTs: nowTs - 30 * 24 * 60 * 60_000, untilTs: nowTs }
  if (range === '1y') return { fromTs: nowTs - 365 * 24 * 60 * 60_000, untilTs: nowTs }

  // all
  return { fromTs: 0, untilTs: nowTs }
}

function safeMinutes(s?: string): number | null {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function parseYmdToDate(s?: string | null): Date | null {
  if (!s) return null
  const parts = String(s).split('-').map(x => Number(x))
  if (parts.length >= 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
  }
  const d = new Date(String(s))
  return Number.isFinite(d.getTime()) ? d : null
}

function getWeeklyAllowedWeekdays(t: Timing): number[] | null {
  const cron = (t.cron ?? '').trim()
  if (cron && cron.startsWith('WEEKDAYS:')) {
    const list = cron.split(':')[1] || ''
    const days = list.split(',').map(x => Number(x)).filter(n => !Number.isNaN(n))
    return days.length ? days : []
  }
  return null
}

function timingAppliesOnDay(t: Timing, day: Date): boolean {
  if (t.type === 'Daily') return true
  if (t.type === 'Date') {
    const d = parseYmdToDate(t.date)
    if (!d) return false
    return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
  }
  if (t.type === 'Weekly') {
    const days = getWeeklyAllowedWeekdays(t)
    if (days === null) return true
    return days.includes(day.getDay())
  }
  if (t.type === 'Monthly') {
    const d = parseYmdToDate(t.date)
    if (!d) return true
    return d.getDate() === day.getDate()
  }
  return false
}

function durationMinutes(start?: string, end?: string): number {
  const sm = safeMinutes(start)
  const em = safeMinutes(end)
  if (sm === null || em === null) return 0
  const d = em - sm
  return d > 0 ? d : 0
}

function computeAutoLoadPerTimingSet(workloadTotalDay: number, timings: Timing[]): number[] {
  // Allocate by (timing duration / total duration). If durations are missing, split equally.
  const durs = timings.map(t => durationMinutes(t.start, t.end))
  const sum = durs.reduce((a, b) => a + b, 0)
  const n = Math.max(1, timings.length)
  if (sum <= 0) return timings.map(() => workloadTotalDay / n)
  return durs.map(d => workloadTotalDay * (d / sum))
}

function buildPlannedSeriesForHabit(h: Habit, minTs: number, maxTs: number): Array<{ ts: number; v: number }> {
  const startTs = Number.isFinite(minTs) ? minTs : 0
  const endTs = Number.isFinite(maxTs) ? maxTs : Date.now()
  if (endTs <= startTs) return []

  const workloadTotalDay = (typeof h.workloadTotal === 'number' && Number.isFinite(h.workloadTotal))
    ? h.workloadTotal
    : ((typeof h.must === 'number' && Number.isFinite(h.must)) ? h.must : null)
  if (workloadTotalDay === null || workloadTotalDay <= 0) return []
  const perDayTarget = workloadTotalDay

  let timings = (Array.isArray((h as any).timings) ? ((h as any).timings as Timing[]) : [])
  if (!timings.length) {
    const start = (h.time ?? undefined) as any
    const end = (h.endTime ?? undefined) as any
    const sm = safeMinutes(start)
    const em = safeMinutes(end)
    if (sm !== null) {
      timings = [{ type: 'Daily', start: start, end: (em !== null ? end : undefined) }]
    } else {
      timings = [{ type: 'Daily', start: '00:00', end: '00:00' }]
    }
  }
  const autoLoads = computeAutoLoadPerTimingSet(workloadTotalDay, timings)

  const startDay = new Date(startTs)
  startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(endTs)
  endDay.setHours(0, 0, 0, 0)

  let cum = 0
  const series: Array<{ ts: number; v: number }> = []

  for (let dayTs = startDay.getTime(); dayTs <= endDay.getTime(); dayTs += 24 * 60 * 60_000) {
    const day = new Date(dayTs)

    const idxs: number[] = []
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i]
      if (!t) continue
      if (t.type === 'Date') {
        const d = t.date ? parseYmdToDate(t.date) : null
        if (!d) continue
        const d0 = new Date(d)
        d0.setHours(0, 0, 0, 0)
        if (d0.getTime() !== dayTs) continue
        idxs.push(i)
        continue
      }
      if (timingAppliesOnDay(t, day)) idxs.push(i)
    }

    if (!idxs.length) continue

    const loadsRaw = idxs.map(i => autoLoads[i] ?? 0)
    const sumRaw = loadsRaw.reduce((a, b) => a + b, 0)
    const scale = sumRaw > 0 ? (perDayTarget / sumRaw) : 1

    for (let j = 0; j < idxs.length; j++) {
      const i = idxs[j]
      const t = timings[i]
      if (!t) continue

      const endMinRaw = safeMinutes(t.end)
      const endMin = endMinRaw !== null ? endMinRaw : 0
      const ts = endMinRaw !== null
        ? (dayTs + endMin * 60_000)
        : (dayTs + 24 * 60 * 60_000)

      cum += (autoLoads[i] ?? 0) * scale
      if (ts >= startTs && ts <= endTs) series.push({ ts, v: cum })
    }
  }

  if (!series.length) return []

  series.sort((a, b) => a.ts - b.ts)
  const dedup: typeof series = []
  for (const p of series) {
    const last = dedup[dedup.length - 1]
    if (!last || last.ts !== p.ts) dedup.push(p)
    else last.v = Math.max(last.v, p.v)
  }
  return dedup
}

function isRecurring(repeat: string | null | undefined) {
  if (!repeat) return false
  const r = repeat.trim().toLowerCase()
  if (!r) return false
  return r !== 'none' && r !== 'no' && r !== 'false' && r !== '0' && r !== 'does not repeat'
}

function plannedCumulativeAtTs(
  h: Habit,
  startTs: number,
  ts: number,
) {
  const series = buildPlannedSeriesForHabit(h as any, startTs, ts)
  if (!series.length) return 0
  let v = 0
  for (const p of series) {
    if (p.ts <= ts) v = p.v
    else break
  }
  return v
}

function computeCustomTodayWindow() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const from = d.getTime()
  // default until: today 23:59 (not tomorrow 00:00)
  const until = from + (24 * 60 - 1) * 60_000
  return { from, until }
}

function buildEventPoints(
  habits: Habit[],
  activities: Activity[],
  visibleHabitIds: string[],
  range: RangeKey,
  customWindow?: { fromTs: number; untilTs: number },
): EventPoint[] {
  const visible = new Set(visibleHabitIds)
  const habitMap = new Map(habits.map(h => [h.id, h]))

  const filtered = activities
    .filter(a => (a.kind === 'pause' || a.kind === 'complete'))
    .filter(a => a.habitId && visible.has(a.habitId))
    .map(a => ({ a, ts: safeTs(a.timestamp) }))
    .filter(x => x.ts > 0)
    .sort((x, y) => x.ts - y.ts)

  const startTs = (() => {
    if (customWindow) return customWindow.fromTs
    if (range === 'auto') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    return getRangeStartTs(range)
  })()

  const endTs = (() => {
    if (customWindow) return customWindow.untilTs
    if (range === 'auto') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      return d.getTime() + 24 * 60 * 60_000
    }
    return Number.POSITIVE_INFINITY
  })()

  // For auto/24h ranges, merge activities within 1 minute of each other for the same habit
  let processedActivities = filtered
  if (range === 'auto' || range === '24h') {
    const mergedActivities: Array<{ a: Activity; ts: number }> = []
    const oneMinute = 60 * 1000 // 1 minute in milliseconds
    
    for (const current of filtered) {
      if (current.ts < startTs || current.ts > endTs) continue
      
      // Find if there's a recent activity for the same habit within 1 minute
      const recentIndex = mergedActivities.findIndex(prev => 
        prev.a.habitId === current.a.habitId && 
        (current.ts - prev.ts) <= oneMinute
      )
      
      if (recentIndex >= 0) {
        // Merge with existing activity
        const existing = mergedActivities[recentIndex]
        const existingAmount = (typeof existing.a.amount === 'number' && Number.isFinite(existing.a.amount)) ? existing.a.amount : 0
        const currentAmount = (typeof current.a.amount === 'number' && Number.isFinite(current.a.amount)) ? current.a.amount : 0
        
        // Create merged activity: use first timestamp, sum amounts, use last kind
        const mergedActivity: Activity = {
          ...existing.a,
          amount: existingAmount + currentAmount,
          kind: current.a.kind, // Use last activity's kind
          timestamp: existing.a.timestamp // Keep first timestamp
        }
        
        mergedActivities[recentIndex] = { a: mergedActivity, ts: existing.ts }
      } else {
        // Add as new activity
        mergedActivities.push(current)
      }
    }
    
    processedActivities = mergedActivities
  } else {
    // For extended ranges (7d/1mo/1y), use original activities
    processedActivities = filtered.filter(x => x.ts >= startTs && x.ts <= endTs)
  }

  // We'll compute cumulative workload as sum of `amount` deltas within the selected window.
  // The app records `amount` for complete and 0 for pause; treat null as 0.
  const cumByHabit = new Map<string, number>()
  const out: EventPoint[] = []

  for (const { a, ts } of processedActivities) {
    if (!a.habitId) continue

    const habit = habitMap.get(a.habitId)
    const unit = (habit?.workloadUnit ?? '') || 'work'
    const total = (habit?.workloadTotal ?? habit?.must ?? null) as number | null

    const delta = (typeof a.amount === 'number' && Number.isFinite(a.amount)) ? a.amount : 0
    const prevCum = cumByHabit.get(a.habitId) ?? 0
    const nextCum = prevCum + delta
    cumByHabit.set(a.habitId, nextCum)

    const denom = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : null
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
    const progressDelta = denom ? clamp01(delta / denom) : 0
    const progressCumulative = denom ? clamp01(nextCum / denom) : 0

    out.push({
      habitId: a.habitId,
      ts,
      iso: a.timestamp || '',
      kind: a.kind as any,
      workloadDelta: delta,
      workloadCumulative: nextCum,
      workloadTotal: total,
      // progress is computed later using planned-total as denominator
      progressDelta: 0,
      progressCumulative: 0,
      workloadUnit: unit,
    })
  }

  return out
}

function LineChart({ points, height = 180 }: { points: Point[]; height?: number }) {
  const width = 640
  const padding = 28
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  const maxY = Math.max(1, ...points.map(p => p.value))

  const xOf = (i: number) => {
    if (points.length <= 1) return padding
    return padding + (innerW * i) / (points.length - 1)
  }

  const yOf = (v: number) => padding + innerH * (1 - v / maxY)

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(2)} ${yOf(p.value).toFixed(2)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* axes */}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity={0.25} />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity={0.25} />

      {/* y labels (0 and max) */}
      <text x={padding - 6} y={height - padding + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>0</text>
      <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>{maxY}</text>

      {/* line */}
      {points.length >= 2 ? (
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} />
      ) : null}

      {/* points */}
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={xOf(i)} cy={yOf(p.value)} r={3} fill="currentColor" />
        </g>
      ))}

      {/* x labels: first/last */}
      {points[0] ? (
        <text x={xOf(0)} y={height - 8} textAnchor="start" fontSize={10} fill="currentColor" opacity={0.6}>
          {points[0].date}
        </text>
      ) : null}
      {points.length > 1 ? (
        <text x={xOf(points.length - 1)} y={height - 8} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>
          {points[points.length - 1].date}
        </text>
      ) : null}
    </svg>
  )
}

export default function StaticsSection({ habits, activities, goals }: { habits: Habit[]; activities: Activity[]; goals?: Goal[] }) {
  const { isLeftHanded } = useHandedness();
  // Carousel (we'll add more stat pages later)
  const pages = React.useMemo(() => ([
    { id: 'counts', title: 'Counts vs Time' },
    { id: 'heatmap', title: 'Activity Heatmap' },
    { id: 'summary', title: 'Summary' },
    { id: 'goals', title: 'Goals' },
  ] as const), [])
  const [pageIndex, setPageIndex] = React.useState(0)

  // Graph controls - allow range selection
  const [range, setRange] = React.useState<RangeKey>('7d')
  const [editGraphOpen, setEditGraphOpen] = React.useState(false)
  const [editGoalGraphOpen, setEditGoalGraphOpen] = React.useState(false)

  // Compute window based on selected range
  const { fromTs, untilTs } = React.useMemo(() => {
    const now = Date.now()
    const w = computeRangeWindow(range, now)
    return { fromTs: w.fromTs, untilTs: w.untilTs }
  }, [range])

  // For now default to showing all habits; later we'll allow narrowing via Edit Graph.
  const [visibleHabitIds, setVisibleHabitIds] = React.useState<string[]>(() => habits.map(h => h.id))
  React.useEffect(() => {
    // Keep visibility list in sync when habits change.
    setVisibleHabitIds((prev) => {
      const existing = new Set(habits.map(h => h.id))
      const filtered = prev.filter(id => existing.has(id))
      return filtered.length ? filtered : habits.map(h => h.id)
    })
  }, [habits])

  // Goal visibility management
  const [visibleGoalIds, setVisibleGoalIds] = React.useState<string[]>(() => (goals ?? []).map(g => g.id))
  React.useEffect(() => {
    // Keep goal visibility list in sync when goals change.
    setVisibleGoalIds((prev) => {
      const existing = new Set((goals ?? []).map(g => g.id))
      const filtered = prev.filter(id => existing.has(id))
      return filtered.length ? filtered : (goals ?? []).map(g => g.id)
    })
  }, [goals])

  const baseEventPoints = React.useMemo(() => {
    // If user picked custom window, always filter by it.
    const custom = Number.isFinite(fromTs) && Number.isFinite(untilTs) && untilTs > fromTs
      ? { fromTs, untilTs }
      : undefined

    // When a custom window exists, it overrides the preset range.
    return buildEventPoints(habits, activities as any, visibleHabitIds, range, custom)
  }, [habits, activities, visibleHabitIds, range, fromTs, untilTs])

  const eventPoints = baseEventPoints

  const activeWindow = React.useMemo(() => {
    return (Number.isFinite(fromTs) && Number.isFinite(untilTs) && untilTs > fromTs)
      ? { fromTs, untilTs }
      : undefined
  }, [fromTs, untilTs])

  const activePage = pages[pageIndex]?.id ?? 'counts'

  const hasAnyRecurringVisibleHabit = React.useMemo(() => {
    const visible = new Set(visibleHabitIds)
    return habits.some(h => visible.has(h.id) && isRecurring(h.repeat))
  }, [habits, visibleHabitIds])

  const stats = React.useMemo(() => {
    const now = Date.now()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayStartTs = todayStart.getTime()
    const todayEndTs = todayStartTs + (24 * 60 - 1) * 60_000

    const visible = new Set(visibleHabitIds)
    const recurringVisibleHabits = habits.filter(h => visible.has(h.id) && isRecurring(h.repeat))

    // progress ratio is based on planned-total denominator (same logic as chart)
    const progressByHabit = recurringVisibleHabits
      .map((h) => {
        const series = buildPlannedSeriesForHabit(h as any, todayStartTs, todayEndTs)
        const total = series.length ? series[series.length - 1].v : 0
        const todayActivities = activities
          .filter(a => (a.kind === 'pause' || a.kind === 'complete'))
          .filter(a => a.habitId === h.id)
          .map(a => safeTs(a.timestamp))
          .filter(ts => ts >= todayStartTs && ts <= todayEndTs)

        let done = 0
        for (const ts of todayActivities) {
          done = Math.max(done, plannedCumulativeAtTs(h, todayStartTs, ts))
        }
        const ratio = safePct(done, total)
        return { habit: h, ratio, total, done }
      })
      .sort((a, b) => b.ratio - a.ratio)

    const top3 = progressByHabit.slice(0, 3)
    const worst3 = [...progressByHabit].sort((a, b) => a.ratio - b.ratio).slice(0, 3)

    // Habit achievement rate
    // Today: ratio >= 1 at end of day window based on recorded progress
    const todayAchieved = progressByHabit.filter(x => x.ratio >= 1).length
    const todayTotal = progressByHabit.length

    // Cumulative: approximate using the selected window (custom if valid else based on range)
    const windowStartTs = activeWindow?.fromTs ?? getRangeStartTs(range)
    const windowEndTs = activeWindow?.untilTs ?? now

    const cumulativeProgressByHabit = recurringVisibleHabits.map((h) => {
      const series = buildPlannedSeriesForHabit(h as any, windowStartTs, windowEndTs)
      const total = series.length ? series[series.length - 1].v : 0
      const habitActs = activities
        .filter(a => (a.kind === 'pause' || a.kind === 'complete'))
        .filter(a => a.habitId === h.id)
        .map(a => safeTs(a.timestamp))
        .filter(ts => ts >= windowStartTs && ts <= windowEndTs)

      let done = 0
      for (const ts of habitActs) {
        done = Math.max(done, plannedCumulativeAtTs(h, windowStartTs, ts))
      }
      const ratio = safePct(done, total)
      return { habit: h, ratio, total, done }
    })

    const cumulativeAchieved = cumulativeProgressByHabit.filter(x => x.ratio >= 1).length
    const cumulativeTotal = cumulativeProgressByHabit.length

    const goalsArr = goals ?? []
    // Goal achievement rate: based on isCompleted; "today" uses updatedAt local date.
    const goalsCompleted = goalsArr.filter(g => !!g.isCompleted)
    const goalsCompletedToday = goalsCompleted.filter(g => {
      const ts = safeTs((g.updatedAt ?? g.createdAt ?? '') as any)
      return ts > 0 && isSameLocalDay(ts, now)
    })

    return {
      recurringVisibleHabits,
      top3,
      worst3,
      habitRateToday: { achieved: todayAchieved, total: todayTotal, pct: safePct(todayAchieved, todayTotal) },
      habitRateTotal: { achieved: cumulativeAchieved, total: cumulativeTotal, pct: safePct(cumulativeAchieved, cumulativeTotal) },
      goalRateToday: { achieved: goalsCompletedToday.length, total: goalsArr.length, pct: safePct(goalsCompletedToday.length, goalsArr.length) },
      goalRateTotal: { achieved: goalsCompleted.length, total: goalsArr.length, pct: safePct(goalsCompleted.length, goalsArr.length) },
    }
  }, [habits, activities, visibleHabitIds, range, activeWindow, goals])

  return (
    <section className="relative rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      {/* Edge-attached carousel arrows (replaces old buttons) */}
      <button
        type="button"
        aria-label="Previous"
        title="Previous"
        onClick={() => setPageIndex((i) => (i - 1 + pages.length) % pages.length)}
        className={`absolute ${isLeftHanded ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'} top-1/2 z-10 -translate-y-1/2 h-14 w-14 rounded-full border bg-white/40 shadow-sm backdrop-blur text-zinc-800 transition hover:bg-white/60 dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-100 dark:hover:bg-slate-900/55 opacity-60 hover:opacity-100`}
      >
        {isLeftHanded ? '→' : '←'}
      </button>
      <button
        type="button"
        aria-label="Next"
        title="Next"
        onClick={() => setPageIndex((i) => (i + 1) % pages.length)}
        className={`absolute ${isLeftHanded ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2'} top-1/2 z-10 -translate-y-1/2 h-14 w-14 rounded-full border bg-white/40 shadow-sm backdrop-blur text-zinc-800 transition hover:bg-white/60 dark:border-slate-700 dark:bg-slate-900/35 dark:text-slate-100 dark:hover:bg-slate-900/55 opacity-60 hover:opacity-100`}
      >
        {isLeftHanded ? '←' : '→'}
      </button>

      <div className={`flex items-start gap-3 ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
        <div>
          <h2 className="text-lg font-medium">Statics</h2>
          <div className="text-xs text-zinc-500">Stats & charts</div>
        </div>
      </div>

      {/* Controls (apply to current page) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* Range, from, until controls removed - fixed to today's range */}
      </div>

      {/* Responsive height page viewport */}
      <div className="mt-4 rounded border border-zinc-100 dark:border-slate-800 h-[520px] sm:h-[400px] md:h-[520px] overflow-hidden">
        <div className="h-full overflow-auto p-3">
          {activePage === 'summary' ? (
            <div className="min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <div className="text-xs text-zinc-500">現在のHabit</div>
                <div className="mt-1 text-2xl font-semibold">{stats.recurringVisibleHabits.length}</div>
                <div className="mt-2 text-xs text-zinc-500">(表示対象・繰り返しHabitのみ)</div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <div className="text-xs text-zinc-500">Habit達成率(本日)</div>
                <div className="mt-1 text-2xl font-semibold">{Math.round(stats.habitRateToday.pct * 100)}%</div>
                <div className="mt-1 text-xs text-zinc-500">{stats.habitRateToday.achieved}/{stats.habitRateToday.total}</div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <div className="text-xs text-zinc-500">Habit達成率(累計/選択範囲)</div>
                <div className="mt-1 text-2xl font-semibold">{Math.round(stats.habitRateTotal.pct * 100)}%</div>
                <div className="mt-1 text-xs text-zinc-500">{stats.habitRateTotal.achieved}/{stats.habitRateTotal.total}</div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <div className="text-xs text-zinc-500">Goal達成率(本日)</div>
                <div className="mt-1 text-2xl font-semibold">{Math.round(stats.goalRateToday.pct * 100)}%</div>
                <div className="mt-1 text-xs text-zinc-500">{stats.goalRateToday.achieved}/{stats.goalRateToday.total}</div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <div className="text-xs text-zinc-500">Goal達成率(累計)</div>
                <div className="mt-1 text-2xl font-semibold">{Math.round(stats.goalRateTotal.pct * 100)}%</div>
                <div className="mt-1 text-xs text-zinc-500">{stats.goalRateTotal.achieved}/{stats.goalRateTotal.total}</div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800 sm:col-span-2 lg:col-span-3">
                <div className="text-xs text-zinc-500">進捗の良いHabit TOP3 (今日)</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {stats.top3.length ? stats.top3.map((x) => (
                    <div key={x.habit.id} className="rounded bg-zinc-50 p-2 dark:bg-slate-900/40">
                      <div className="text-sm font-medium truncate">{x.habit.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{Math.round(x.ratio * 100)}%</div>
                    </div>
                  )) : (
                    <div className="text-sm text-zinc-500">No recurring habits.</div>
                  )}
                </div>
              </div>

              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800 sm:col-span-2 lg:col-span-3">
                <div className="text-xs text-zinc-500">進捗の悪いHabit Worst3 (今日)</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {stats.worst3.length ? stats.worst3.map((x) => (
                    <div key={x.habit.id} className="rounded bg-zinc-50 p-2 dark:bg-slate-900/40">
                      <div className="text-sm font-medium truncate">{x.habit.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{Math.round(x.ratio * 100)}%</div>
                    </div>
                  )) : (
                    <div className="text-sm text-zinc-500">No recurring habits.</div>
                  )}
                </div>
              </div>
              </div>
            </div>
          ) : activePage === 'heatmap' ? (
            <div className="min-w-0">
              <HeatmapWidget
                habits={habits}
                activities={activities}
                visibleHabitIds={visibleHabitIds}
                range="month"
              />
              
              {/* Edit Graph button for heatmap */}
              <div className={`mt-4 flex ${isLeftHanded ? 'justify-start' : 'justify-end'}`}>
                <button 
                  className="rounded border px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
                  onClick={() => setEditGraphOpen(true)}
                >
                  Edit Habits
                </button>
              </div>
            </div>
          ) : activePage === 'goals' ? (
            <div className="min-w-0">
              <GoalMermaid 
                goals={(goals ?? []) as SharedGoal[]} 
                compact={true} 
                showErrorDetails={true} 
                onEditGraph={() => setEditGoalGraphOpen(true)}
                visibleGoalIds={visibleGoalIds}
              />
            </div>
          ) : (
            <>
            {eventPoints.length === 0 && !hasAnyRecurringVisibleHabit ? (
              <div className="text-sm text-zinc-500">No Pause/Done activity points in this range yet.</div>
            ) : (
              <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
                <MultiEventChart 
                  habits={habits} 
                  points={eventPoints} 
                  visibleHabitIds={visibleHabitIds} 
                  onHover={() => {}} 
                  range={range} 
                  timeWindow={activeWindow}
                  onEditGraph={() => setEditGraphOpen(true)}
                  onRangeChange={setRange}
                />
              </div>
            )}
            </>
          )}
        </div>
      </div>


      {editGraphOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
          <div className="w-full max-w-lg rounded bg-white px-4 pt-4 pb-4 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Edit Graph</h3>
              <button onClick={() => setEditGraphOpen(false)} className="text-slate-500">✕</button>
            </div>

            <div className="mt-3 text-xs text-slate-500">Select which habits are shown in this graph.</div>

            <div className="mt-3 max-h-[50vh] overflow-auto space-y-2 pr-2">
              {habits.map((h) => {
                const checked = visibleHabitIds.includes(h.id)
                return (
                  <label key={h.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked
                        setVisibleHabitIds((prev) => {
                          if (on) return prev.includes(h.id) ? prev : [...prev, h.id]
                          const next = prev.filter(id => id !== h.id)
                          return next.length ? next : prev
                        })
                      }}
                    />
                    <span>{h.name}</span>
                  </label>
                )
              })}
            </div>

            <div className={`mt-4 flex gap-2 ${isLeftHanded ? 'justify-start' : 'justify-end'}`}>
              <button className="rounded border px-3 py-2" onClick={() => setEditGraphOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}

      {editGoalGraphOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
          <div className="w-full max-w-lg rounded bg-white px-4 pt-4 pb-4 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Edit Goal Graph</h3>
              <button onClick={() => setEditGoalGraphOpen(false)} className="text-slate-500">✕</button>
            </div>

            <div className="mt-3 text-xs text-slate-500">Select which goals are shown in this diagram.</div>

            <div className="mt-3 max-h-[50vh] overflow-auto space-y-2 pr-2">
              {(goals ?? []).map((g) => {
                const checked = visibleGoalIds.includes(g.id)
                return (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked
                        setVisibleGoalIds((prev) => {
                          if (on) return prev.includes(g.id) ? prev : [...prev, g.id]
                          const next = prev.filter(id => id !== g.id)
                          return next.length ? next : prev
                        })
                      }}
                    />
                    <span className="flex-1">{g.name}</span>
                    {g.parentId && (
                      <span className="text-xs text-zinc-400">
                        → {(goals ?? []).find(p => p.id === g.parentId)?.name || 'Unknown Parent'}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>

            <div className={`mt-4 flex gap-2 ${isLeftHanded ? 'justify-start' : 'justify-end'}`}>
              <button className="rounded border px-3 py-2" onClick={() => setEditGoalGraphOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
