"use client"

import React from 'react'
import RadialEventChart from './Widget.MultiEventChart.Radial'
import TreeRingEventChart from './Widget.MultiEventChart.TreeRing'

type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly'
type Timing = {
  id?: string
  type: TimingType
  date?: string
  start?: string
  end?: string
  cron?: string
}

type Habit = {
  id: string
  name: string
  createdAt?: string | null
  dueDate?: string | null
  repeat?: string | null
  // schedule
  timings?: Timing[] | null
  outdates?: Timing[] | null
  // legacy-ish fields used by calendar UI
  time?: string | null
  endTime?: string | null
  // workload
  workloadUnit?: string | null
  workloadTotal?: number | null
  must?: number | null
  workloadPerCount?: number | null
}

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

  // Planned load is based on Workload Total(Day) and Timing rows.
  // We allocate workloadTotal across timing rows by (timing duration / total duration),
  // which matches the Habit modal's "Auto Load / Set".
  const workloadTotalDay = (typeof h.workloadTotal === 'number' && Number.isFinite(h.workloadTotal))
    ? h.workloadTotal
    : ((typeof h.must === 'number' && Number.isFinite(h.must)) ? h.must : null)
  if (workloadTotalDay === null || workloadTotalDay <= 0) return []
  const perDayTarget = workloadTotalDay

  let timings = (Array.isArray((h as any).timings) ? ((h as any).timings as Timing[]) : [])
  // Fallback: if timings are missing, synthesize one from repeat + time/endTime.
  if (!timings.length) {
    const start = (h.time ?? undefined) as any
    const end = (h.endTime ?? undefined) as any
    const sm = safeMinutes(start)
    const em = safeMinutes(end)
    // only synthesize if we have a usable time (otherwise later we'll default to all-day)
    if (sm !== null) {
      timings = [{ type: 'Daily', start: start, end: (em !== null ? end : undefined) }]
    } else {
      // last resort: assume a daily occurrence sometime in the day
      timings = [{ type: 'Daily', start: '00:00', end: '00:00' }]
    }
  }
  const autoLoads = computeAutoLoadPerTimingSet(workloadTotalDay, timings)

  // Requirement update:
  // 100% should mean "if you completed this habit as scheduled for the whole window".
  // So we simulate each day in the selected window, apply timing rules, and accumulate
  // Auto Load/Set across all occurrences.
  const startDay = new Date(startTs)
  startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(endTs)
  endDay.setHours(0, 0, 0, 0)

  let cum = 0
  const series: Array<{ ts: number; v: number }> = []

  for (let dayTs = startDay.getTime(); dayTs <= endDay.getTime(); dayTs += 24 * 60 * 60_000) {
    const day = new Date(dayTs)

    // Gather this day's applicable timings (in table order).
    const idxs: number[] = []
    for (let i = 0; i < timings.length; i++) {
      const t = timings[i]
      if (!t) continue
      if (t.type === 'Date') {
        // Date timings are independent of window-day iteration.
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

    // Scale daily total if not all timing rows apply (e.g., Weekly selections).
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

  // If we never produced any planned points, no line should be drawn.
  if (!series.length) return []

  // Do NOT extend to chart end.
  // Requirement: planned plots are only at each timing row's End time.
  // sort & de-dupe by ts
  series.sort((a, b) => a.ts - b.ts)
  const dedup: typeof series = []
  for (const p of series) {
    const last = dedup[dedup.length - 1]
    if (!last || last.ts !== p.ts) dedup.push(p)
    else last.v = Math.max(last.v, p.v)
  }
  return dedup
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

function computeDomainTs(range: RangeKey, points: EventPoint[], timeWindow?: { fromTs: number; untilTs: number }): { minTs: number; maxTs: number } {
  const now = Date.now()
  
  // Use custom time window if provided and valid
  if (timeWindow && Number.isFinite(timeWindow.fromTs) && Number.isFinite(timeWindow.untilTs) && timeWindow.untilTs > timeWindow.fromTs) {
    return { minTs: timeWindow.fromTs, maxTs: timeWindow.untilTs }
  }
  
  if (range === 'auto') {
    // Auto: today window
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    const start = d.getTime()
    // Domain uses [00:00 .. 24:00) so the chart reaches the end of day.
    const end = start + 24 * 60 * 60_000
    return { minTs: start, maxTs: end }
  }
  
  // For extended ranges (7d/1mo/1y), align to day boundaries for consistent daily aggregation
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999) // End of current day
  const maxTs = endDate.getTime()
  
  const startDate = new Date(now)
  if (range === '24h') {
    startDate.setTime(now - 24 * 60 * 60_000)
  } else if (range === '7d') {
    startDate.setDate(startDate.getDate() - 6) // 7 days including today
    startDate.setHours(0, 0, 0, 0)
  } else if (range === '1mo') {
    startDate.setDate(startDate.getDate() - 29) // 30 days including today
    startDate.setHours(0, 0, 0, 0)
  } else if (range === '1y') {
    startDate.setDate(startDate.getDate() - 364) // 365 days including today
    startDate.setHours(0, 0, 0, 0)
  } else {
    return { minTs: getRangeStartTs(range), maxTs: now }
  }
  
  return { minTs: startDate.getTime(), maxTs }
}

// Helper function to get day start timestamp
function getDayStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// Helper function to get day end timestamp
function getDayEnd(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

// Build daily aggregated series for extended time ranges
function buildDailyAggregatedSeries(
  habits: Habit[],
  points: EventPoint[],
  visibleHabitIds: string[],
  minTs: number,
  maxTs: number,
  range: RangeKey
): {
  actualSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
  plannedSeriesByHabit: Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>
} {
  const actualSeriesByHabit = new Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>()
  const plannedSeriesByHabit = new Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>()
  
  // Only aggregate for extended ranges
  if (!['7d', '1mo', '1y'].includes(range)) {
    return { actualSeriesByHabit, plannedSeriesByHabit }
  }
  
  const habitMap = new Map(habits.map(h => [h.id, h]))
  
  // Generate daily timestamps
  const dailyTimestamps: number[] = []
  for (let dayTs = getDayStart(minTs); dayTs <= getDayStart(maxTs); dayTs += 24 * 60 * 60_000) {
    dailyTimestamps.push(dayTs)
  }
  
  for (const habitId of visibleHabitIds) {
    const habit = habitMap.get(habitId)
    if (!habit || !isRecurring(habit.repeat)) continue
    
    // Get habit creation date
    const habitCreatedTs = habit.createdAt ? new Date(habit.createdAt).getTime() : minTs
    const effectiveStartTs = Math.max(habitCreatedTs, minTs)
    
    // Calculate expected total for the range (from habit creation or range start to range end)
    let totalExpectedForRange = 0
    
    // Check if habit has workload total
    const workloadTotalDay = (typeof habit.workloadTotal === 'number' && Number.isFinite(habit.workloadTotal))
      ? habit.workloadTotal
      : ((typeof habit.must === 'number' && Number.isFinite(habit.must)) ? habit.must : null)
    
    if (workloadTotalDay && workloadTotalDay > 0) {
      // Use existing planned series logic for habits with workload total
      const plannedSeries = buildPlannedSeriesForHabit(habit, effectiveStartTs, maxTs)
      totalExpectedForRange = plannedSeries.length > 0 ? Math.max(0, ...plannedSeries.map(p => p.v)) : 0
    } else {
      // For habits without workload total, calculate based on daily occurrences
      // Count expected occurrences from habit creation to range end
      const daysInRange = Math.ceil((maxTs - effectiveStartTs) / (24 * 60 * 60_000))
      
      // Assume 1 unit per day for habits without specific workload
      let timings = (Array.isArray((habit as any).timings) ? ((habit as any).timings as any[]) : [])
      if (!timings.length) {
        // Default to daily if no timings specified
        totalExpectedForRange = daysInRange
      } else {
        // Count expected occurrences based on timing rules
        let expectedOccurrences = 0
        for (let dayTs = getDayStart(effectiveStartTs); dayTs <= getDayStart(maxTs); dayTs += 24 * 60 * 60_000) {
          const day = new Date(dayTs)
          for (const timing of timings) {
            if (timingAppliesOnDay(timing, day)) {
              expectedOccurrences++
              break // Count each day only once regardless of multiple timings
            }
          }
        }
        totalExpectedForRange = expectedOccurrences
      }
    }
    
    if (totalExpectedForRange <= 0) continue
    
    // Group actual points by day
    const actualPointsByDay = new Map<number, EventPoint[]>()
    for (const point of points) {
      if (point.habitId !== habitId) continue
      if (point.ts < minTs || point.ts > maxTs) continue
      
      const dayStart = getDayStart(point.ts)
      const dayPoints = actualPointsByDay.get(dayStart) ?? []
      dayPoints.push(point)
      actualPointsByDay.set(dayStart, dayPoints)
    }
    
    // Build daily series
    const actualDailySeries: Array<{ ts: number; ratio: number; cum: number; total: number }> = []
    const plannedDailySeries: Array<{ ts: number; ratio: number; cum: number; total: number }> = []
    
    let cumulativeActual = 0
    let cumulativePlanned = 0
    
    for (const dayStart of dailyTimestamps) {
      const dayEnd = getDayEnd(dayStart)
      
      // Skip days before habit creation
      if (dayEnd < habitCreatedTs) continue
      
      // Calculate actual progress for this day
      const dayPoints = actualPointsByDay.get(dayStart) ?? []
      let dailyActual = 0
      for (const point of dayPoints) {
        if (workloadTotalDay && workloadTotalDay > 0) {
          dailyActual += point.workloadDelta
        } else {
          // For habits without workload total, count occurrences
          dailyActual += (point.kind === 'complete' ? 1 : 0)
        }
      }
      cumulativeActual += dailyActual
      
      // Calculate planned progress for this day
      if (workloadTotalDay && workloadTotalDay > 0) {
        // Use existing planned series logic
        const plannedSeries = buildPlannedSeriesForHabit(habit, effectiveStartTs, dayEnd)
        cumulativePlanned = plannedSeries.length > 0 ? Math.max(0, ...plannedSeries.map(p => p.v)) : 0
      } else {
        // For habits without workload total, calculate expected occurrences up to this day
        const day = new Date(dayStart)
        let timings = (Array.isArray((habit as any).timings) ? ((habit as any).timings as any[]) : [])
        if (!timings.length) {
          // Default daily occurrence
          cumulativePlanned += 1
        } else {
          // Check if this day should have an occurrence
          for (const timing of timings) {
            if (timingAppliesOnDay(timing, day)) {
              cumulativePlanned += 1
              break // Count each day only once
            }
          }
        }
      }
      
      // Use end of day as timestamp for consistent plotting
      const plotTs = dayEnd
      
      actualDailySeries.push({
        ts: plotTs,
        ratio: Math.max(0, Math.min(1, cumulativeActual / totalExpectedForRange)),
        cum: cumulativeActual,
        total: totalExpectedForRange
      })
      
      plannedDailySeries.push({
        ts: plotTs,
        ratio: Math.max(0, Math.min(1, cumulativePlanned / totalExpectedForRange)),
        cum: cumulativePlanned,
        total: totalExpectedForRange
      })
    }
    
    if (actualDailySeries.length) {
      actualSeriesByHabit.set(habitId, actualDailySeries)
    }
    if (plannedDailySeries.length) {
      plannedSeriesByHabit.set(habitId, plannedDailySeries)
    }
  }
  
  return { actualSeriesByHabit, plannedSeriesByHabit }
}

function isRecurring(repeat: string | null | undefined) {
  if (!repeat) return false
  const r = repeat.trim().toLowerCase()
  if (!r) return false
  // Treat explicit "none" values as non-recurring.
  return r !== 'none' && r !== 'no' && r !== 'false' && r !== '0' && r !== 'does not repeat'
}

function palette(i: number) {
  // Tailwind-ish colors (no dependency)
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4b5563']
  return colors[i % colors.length]
}

export default function MultiEventChart({
  habits,
  points,
  visibleHabitIds,
  onHover,
  range,
  timeWindow,
  onEditGraph,
  onRangeChange,
  displayMode = 'linear',
  onDisplayModeChange,
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  onHover: (p: EventPoint | null) => void
  range: RangeKey
  timeWindow?: { fromTs: number; untilTs: number }
  onEditGraph?: () => void
  onRangeChange?: (range: RangeKey) => void
  displayMode?: 'linear' | 'radial' | 'tree-ring'
  onDisplayModeChange?: (mode: 'linear' | 'radial' | 'tree-ring') => void
}) {
  // ドラッグ状態を管理（円グラフの回転中はボタンクリックを無効化）
  const [isChartDragging, setIsChartDragging] = React.useState(false)
  
  // Tooltip state
  const [tooltip, setTooltip] = React.useState<{
    visible: boolean
    x: number
    y: number
    content: {
      habitName: string
      kind: string
      timestamp: string
      workloadDelta: number
      workloadCumulative: number
      workloadTotal: number | null
      workloadUnit: string
      progressRatio: number
    }
  } | null>(null)

  // Helper function to show tooltip
  const showTooltip = (event: React.MouseEvent, point: EventPoint, progressRatio: number) => {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
    const habit = habits.find(h => h.id === point.habitId)
    
    setTooltip({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      content: {
        habitName: habit?.name ?? point.habitId,
        kind: point.kind === 'pause' ? 'Pause' : 'Done',
        timestamp: new Date(point.ts).toLocaleString(),
        workloadDelta: point.workloadDelta,
        workloadCumulative: point.workloadCumulative,
        workloadTotal: point.workloadTotal,
        workloadUnit: point.workloadUnit,
        progressRatio: progressRatio
      }
    })
    
    // Also call the original onHover for backward compatibility
    onHover(point)
  }

  // Helper function to hide tooltip
  const hideTooltip = () => {
    setTooltip(null)
    onHover(null)
  }

  // Responsive chart dimensions - smaller for mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768
  const width = isMobile ? 600 : 860
  const height = isMobile ? 200 : 250  // Increased to accommodate x-axis labels
  const padding = isMobile ? 20 : 30
  const paddingBottom = isMobile ? 35 : 45  // Extra space for x-axis labels
  const innerW = width - padding * 2
  const innerH = height - padding - paddingBottom

  const habitIds = React.useMemo(() => {
    // Use the user's selection, not only "habits that have points".
    const existing = new Set(habits.map(h => h.id))
    return visibleHabitIds.filter(id => existing.has(id))
  }, [habits, visibleHabitIds])

  const yDomainMax = React.useMemo(() => {
    // Both actual and planned are drawn in progress ratio (0..1).
    return 1
  }, [points, habits, visibleHabitIds])

  // Planned overlays are also plotted as progress ratio (0..1), so they share y-scale with actual.

  const domain = React.useMemo(() => {
    return computeDomainTs(range, points, timeWindow)
  }, [range, points, timeWindow?.fromTs, timeWindow?.untilTs])
  const minTs = domain.minTs
  const maxTs = domain.maxTs

  const xOf = (ts: number) => {
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || minTs === maxTs) return padding
    return padding + innerW * ((ts - minTs) / (maxTs - minTs))
  }
  const yOf = (v: number) => padding + innerH * (1 - v / yDomainMax)

  // Use daily aggregation for extended ranges, original logic for others
  const { actualSeriesByHabit: dailyActualSeries, plannedSeriesByHabit: dailyPlannedSeries } = React.useMemo(() => {
    return buildDailyAggregatedSeries(habits, points, visibleHabitIds, minTs, maxTs, range)
  }, [habits, points, visibleHabitIds, minTs, maxTs, range])

  const pointsByHabit = React.useMemo(() => {
    const m = new Map<string, EventPoint[]>()
    for (const p of points) {
      const arr = m.get(p.habitId) ?? []
      arr.push(p)
      m.set(p.habitId, arr)
    }
    // already sorted overall; ensure each is sorted
    for (const [k, arr] of m.entries()) arr.sort((a, b) => a.ts - b.ts)
    return m
  }, [points])

  const plannedSeriesByHabit = React.useMemo(() => {
    // Use daily aggregated series for extended ranges
    if (['7d', '1mo', '1y'].includes(range)) {
      return dailyPlannedSeries
    }
    
    // Original logic for auto/24h ranges
    const m = new Map<string, Array<{ ts: number; ratio: number; cum: number; total: number }>>()
    for (const hid of habitIds) {
      const h = habits.find(x => x.id === hid)
      if (!h) continue
      if (!isRecurring(h.repeat)) continue
      const series = buildPlannedSeriesForHabit(h, minTs, maxTs)
      if (!series.length) continue
      const total = Math.max(0, ...series.map(p => p.v))
      if (total <= 0) continue
      m.set(hid, series.map(p => ({ ts: p.ts, cum: p.v, total, ratio: Math.max(0, Math.min(1, p.v / total)) })))
    }
    return m
  }, [habitIds, habits, minTs, maxTs, dailyPlannedSeries, range])

  const actualSeriesByHabit = React.useMemo(() => {
    // Use daily aggregated series for extended ranges
    if (['7d', '1mo', '1y'].includes(range)) {
      return dailyActualSeries
    }
    
    // Original logic for auto/24h ranges
    const m = new Map<string, Array<{ ts: number; ratio: number; cum: number; total: number; kind: EventPoint['kind'] }>>()
    for (const hid of habitIds) {
      const planned = plannedSeriesByHabit.get(hid)
      const total = planned?.[planned.length - 1]?.total ?? 0
      if (total <= 0) continue
      const arr = (pointsByHabit.get(hid) ?? []).map((p) => ({
        ts: p.ts,
        cum: p.workloadCumulative,
        total,
        ratio: Math.max(0, Math.min(1, p.workloadCumulative / total)),
        kind: p.kind,
      }))
      if (arr.length) m.set(hid, arr)
    }
    return m
  }, [habitIds, plannedSeriesByHabit, pointsByHabit, dailyActualSeries, range])

  // 同心円グラフの場合は別コンポーネントを使用
  if (displayMode === 'radial') {
    // Legend help tooltip state for radial
    const [showLegendHelp, setShowLegendHelp] = React.useState(false)
    
    return (
      <div className="space-y-3 w-full overflow-hidden">
        {/* Header with Range selector and Edit Graph button */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Habit Progress Timeline (Actual vs Planned)
            </h3>
            {/* Legend Help Button */}
            <div className="relative">
              <button
                className="rounded-full w-5 h-5 flex items-center justify-center text-xs border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onMouseEnter={() => setShowLegendHelp(true)}
                onMouseLeave={() => setShowLegendHelp(false)}
                title="Show legend"
              >
                ?
              </button>
              {showLegendHelp && (
                <div className="absolute right-0 top-6 z-50 w-72 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 p-3 shadow-lg text-xs">
                  <div className="font-medium mb-2 text-zinc-700 dark:text-zinc-200">Chart Legend - Radial View</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                      <span className="text-zinc-600 dark:text-zinc-300">Planned Progress (dashed line)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-zinc-600 dark:text-zinc-300">Actual Progress (solid dots)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="32" height="16" viewBox="0 0 32 16" className="text-blue-500">
                        <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                        <circle cx="16" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                        <circle cx="24" cy="8" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                      </svg>
                      <span className="text-zinc-600 dark:text-zinc-300">Time (center → outer)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="24" height="24" viewBox="0 0 24 24" className="text-blue-500">
                        <path d="M 12 2 A 10 10 0 0 1 22 12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                        <text x="17" y="8" fontSize="8" fill="currentColor" opacity="0.6">100%</text>
                      </svg>
                      <span className="text-zinc-600 dark:text-zinc-300">Progress (angle in sector)</span>
                    </div>
                    <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium mb-1.5 text-zinc-700 dark:text-zinc-200">Progress Indicators:</div>
                      <div className="space-y-1 pl-2">
                        <div className="text-zinc-600 dark:text-zinc-300">• 100% = Full Habit (complete sector)</div>
                        <div className="text-zinc-600 dark:text-zinc-300">• 50% = Half Habit (half sector)</div>
                        <div className="text-zinc-600 dark:text-zinc-300">• 0% = No Habit (sector start)</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔄</span>
                      <span className="text-zinc-600 dark:text-zinc-300">Swipe to rotate</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Controls - wrapped on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Display Mode Toggle */}
            {onDisplayModeChange && (
              <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
                <button
                  className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onDisplayModeChange('linear')}
                  title="Linear timeline view"
                >
                  📊
                </button>
                <button
                  className="rounded px-2 py-1 text-xs transition-colors bg-blue-500 text-white"
                  onClick={() => onDisplayModeChange('radial')}
                  title="Radial timeline view"
                >
                  ⭕
                </button>
                <button
                  className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onDisplayModeChange('tree-ring')}
                  title="Tree ring view"
                >
                  🎯
                </button>
              </div>
            )}
            {/* Range selector buttons */}
            {onRangeChange && (
              <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '7d'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('7d')
                  }}
                >
                  Week
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '1mo'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('1mo')
                  }}
                >
                  Month
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '1y'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('1y')
                  }}
                >
                  Year
                </button>
              </div>
            )}
            {onEditGraph && (
              <button 
                className="rounded border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
                onClick={(e) => {
                  if (isChartDragging) {
                    e.preventDefault()
                    return
                  }
                  onEditGraph()
                }}
              >
                Edit Graph
              </button>
            )}
          </div>
        </div>
        
        <RadialEventChart
          habits={habits}
          points={points}
          visibleHabitIds={visibleHabitIds}
          actualSeriesByHabit={actualSeriesByHabit}
          plannedSeriesByHabit={plannedSeriesByHabit}
          minTs={minTs}
          maxTs={maxTs}
          onHover={onHover}
          onDraggingChange={setIsChartDragging}
        />
      </div>
    )
  }

  // 樹の断面グラフの場合は別コンポーネントを使用
  if (displayMode === 'tree-ring') {
    // Legend help tooltip state for tree-ring
    const [showLegendHelp, setShowLegendHelp] = React.useState(false)
    
    return (
      <div className="space-y-3 w-full overflow-hidden">
        {/* Header with Range selector and Edit Graph button */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Habit Progress Timeline (Actual vs Planned)
            </h3>
            {/* Legend Help Button */}
            <div className="relative">
              <button
                className="rounded-full w-5 h-5 flex items-center justify-center text-xs border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onMouseEnter={() => setShowLegendHelp(true)}
                onMouseLeave={() => setShowLegendHelp(false)}
                title="Show legend"
              >
                ?
              </button>
              {showLegendHelp && (
                <div className="absolute right-0 top-6 z-50 w-72 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 p-3 shadow-lg text-xs">
                  <div className="font-medium mb-2 text-zinc-700 dark:text-zinc-200">Chart Legend - Tree Ring View</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg width="32" height="16" viewBox="0 0 32 16" className="text-blue-500">
                        <path d="M 16 8 m -7 0 a 7 7 0 0 1 7 -7 l 0 7 z" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                      </svg>
                      <span className="text-zinc-600 dark:text-zinc-300">100% = Full sector</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="32" height="16" viewBox="0 0 32 16" className="text-blue-500">
                        <path d="M 16 8 m -7 0 a 7 7 0 0 1 3.5 -6.06" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
                      </svg>
                      <span className="text-zinc-600 dark:text-zinc-300">Incomplete = Arc gap</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg width="32" height="16" viewBox="0 0 32 16" className="text-blue-500">
                        <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                        <circle cx="16" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                        <circle cx="24" cy="8" r="8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
                      </svg>
                      <span className="text-zinc-600 dark:text-zinc-300">Time (center → outer)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔄</span>
                      <span className="text-zinc-600 dark:text-zinc-300">Swipe to rotate</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Controls - wrapped on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Display Mode Toggle */}
            {onDisplayModeChange && (
              <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
                <button
                  className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onDisplayModeChange('linear')}
                  title="Linear timeline view"
                >
                  📊
                </button>
                <button
                  className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  onClick={() => onDisplayModeChange('radial')}
                  title="Radial timeline view"
                >
                  ⭕
                </button>
                <button
                  className="rounded px-2 py-1 text-xs transition-colors bg-blue-500 text-white"
                  onClick={() => onDisplayModeChange('tree-ring')}
                  title="Tree ring view"
                >
                  🎯
                </button>
              </div>
            )}
            {/* Range selector buttons */}
            {onRangeChange && (
              <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '7d'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('7d')
                  }}
                >
                  Week
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '1mo'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('1mo')
                  }}
                >
                  Month
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    range === '1y'
                      ? 'bg-blue-500 text-white'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  onClick={(e) => {
                    if (isChartDragging) {
                      e.preventDefault()
                      return
                    }
                    onRangeChange('1y')
                  }}
                >
                  Year
                </button>
              </div>
            )}
            {onEditGraph && (
              <button 
                className="rounded border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
                onClick={(e) => {
                  if (isChartDragging) {
                    e.preventDefault()
                    return
                  }
                  onEditGraph()
                }}
              >
                Edit Graph
              </button>
            )}
          </div>
        </div>
        
        <TreeRingEventChart
          habits={habits}
          points={points}
          visibleHabitIds={visibleHabitIds}
          actualSeriesByHabit={actualSeriesByHabit}
          plannedSeriesByHabit={plannedSeriesByHabit}
          minTs={minTs}
          maxTs={maxTs}
          onHover={onHover}
          onDraggingChange={setIsChartDragging}
        />
      </div>
    )
  }

  // Legend help tooltip state
  const [showLegendHelp, setShowLegendHelp] = React.useState(false)

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* Header with Range selector and Edit Graph button */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Habit Progress Timeline (Actual vs Planned)
          </h3>
          {/* Legend Help Button */}
          <div className="relative">
            <button
              className="rounded-full w-5 h-5 flex items-center justify-center text-xs border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              onMouseEnter={() => setShowLegendHelp(true)}
              onMouseLeave={() => setShowLegendHelp(false)}
              title="Show legend"
            >
              ?
            </button>
            {showLegendHelp && (
              <div className="absolute right-0 top-6 z-50 w-64 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-slate-900 p-3 shadow-lg text-xs">
                <div className="font-medium mb-2 text-zinc-700 dark:text-zinc-200">Chart Legend</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-blue-500"></div>
                    <span className="text-zinc-600 dark:text-zinc-300">Actual Progress (solid line)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 border-t-2 border-dashed border-blue-500"></div>
                    <span className="text-zinc-600 dark:text-zinc-300">Planned Progress (dashed line)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-zinc-600 dark:text-zinc-300">Actual Data Point</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-dashed border-blue-500"></div>
                    <span className="text-zinc-600 dark:text-zinc-300">Planned Data Point</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Controls - wrapped on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Display Mode Toggle */}
          {onDisplayModeChange && (
            <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
              <button
                className="rounded px-2 py-1 text-xs transition-colors bg-blue-500 text-white"
                onClick={() => onDisplayModeChange('linear')}
                title="Linear timeline view"
              >
                📊
              </button>
              <button
                className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => onDisplayModeChange('radial')}
                title="Radial timeline view"
              >
                ⭕
              </button>
              <button
                className="rounded px-2 py-1 text-xs transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => onDisplayModeChange('tree-ring')}
                title="Tree ring view"
              >
                🎯
              </button>
            </div>
          )}
          {/* Range selector buttons */}
          {onRangeChange && (
            <div className="flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 p-0.5">
              <button
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  range === '7d'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                onClick={() => onRangeChange('7d')}
              >
                Week
              </button>
              <button
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  range === '1mo'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                onClick={() => onRangeChange('1mo')}
              >
                Month
              </button>
              <button
                className={`rounded px-2 py-1 text-xs transition-colors ${
                  range === '1y'
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
                onClick={() => onRangeChange('1y')}
              >
                Year
              </button>
            </div>
          )}
          {onEditGraph && (
            <button 
              className="rounded border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
              onClick={onEditGraph}
            >
              Edit Graph
            </button>
          )}
        </div>
      </div>
      
      {/* Chart */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[400px] sm:min-w-[600px]">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <line x1={padding} y1={height - paddingBottom} x2={width - padding} y2={height - paddingBottom} stroke="currentColor" opacity={0.25} />
          <line x1={padding} y1={padding} x2={padding} y2={height - paddingBottom} stroke="currentColor" opacity={0.25} />

      {/* x-axis date labels */}
      {(() => {
        const ticks: Array<{ ts: number; label: string }> = []
        const rangeMs = maxTs - minTs
        
        // Determine appropriate tick interval based on range
        let tickCount = 5
        if (range === '7d') tickCount = 7
        else if (range === '1mo') tickCount = 6
        else if (range === '1y') tickCount = 12
        
        for (let i = 0; i <= tickCount; i++) {
          const ts = minTs + (rangeMs * i) / tickCount
          const d = new Date(ts)
          const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
          ticks.push({ ts, label })
        }
        
        return ticks.map((tick, idx) => {
          const x = xOf(tick.ts)
          const y = height - paddingBottom
          return (
            <g key={`tick-${idx}`}>
              {/* Tick mark */}
              <line 
                x1={x} 
                y1={y} 
                x2={x} 
                y2={y + 5} 
                stroke="currentColor" 
                opacity={0.25} 
              />
              {/* Date label */}
              <text
                x={x}
                y={y + 15}
                textAnchor="middle"
                fontSize="10"
                fill="currentColor"
                opacity={0.6}
              >
                {tick.label}
              </text>
            </g>
          )
        })
      })()}

      {/* y-axis numeric labels removed by request */}

      {/* lines per habit (workloadAt proxy / count) */}
      {habitIds.map((hid, i) => {
        const color = palette(i)
        
        // For extended ranges, use daily aggregated series
        if (['7d', '1mo', '1y'].includes(range)) {
          const actualSeries = actualSeriesByHabit.get(hid) ?? []
          const plannedSeries = plannedSeriesByHabit.get(hid) ?? []
          
          // Draw actual line
          const actualD = actualSeries
            .map((p, idx) => {
              const x = xOf(p.ts)
              const y = yOf(p.ratio)
              return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            })
            .join(' ')
          
          // Draw planned line
          const plannedD = plannedSeries
            .map((p, idx) => {
              const x = xOf(p.ts)
              const y = yOf(p.ratio)
              return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
            })
            .join(' ')
          
          return (
            <g key={hid + ':dailyLines'}>
              {/* Actual line (solid) */}
              {actualD ? (
                <path 
                  d={actualD} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth={2} 
                  opacity={0.75} 
                />
              ) : null}
              
              {/* Planned line (dashed) */}
              {plannedD ? (
                <path 
                  d={plannedD} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth={1.8} 
                  opacity={0.55} 
                  strokeDasharray="6 5" 
                />
              ) : null}
            </g>
          )
        }
        
        // Original logic for auto/24h ranges
        const arr = actualSeriesByHabit.get(hid) ?? []
        const d = arr
          .map((p, idx) => {
            const x = xOf(p.ts)
            const y = yOf(p.ratio)
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
          })
          .join(' ')
        return d ? <path key={hid} d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.75} /> : null
      })}

      {/* planned series (Timing End points only): connect planned-to-planned for each Habit */}
      {habitIds.map((hid, i) => {
        const planned = plannedSeriesByHabit.get(hid) ?? []
        if (!planned.length) return null
        const color = palette(i)

        // If planned points are sparse, add a baseline segment from 0% at the window start.
        const first = planned[0]
        const last = planned[planned.length - 1]
        const baselineD = (() => {
          if (!first) return ''
          const x0 = xOf(minTs)
          const y0 = yOf(0)
          const x1 = xOf(first.ts)
          const y1 = yOf(first.ratio)
          // Only draw if it has visible width.
          if (Math.abs(x1 - x0) < 0.5) return ''
          return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`
        })()

        // Extend after the last planned point with slope 0 until the window end.
        const extensionD = (() => {
          if (!last) return ''
          const x0 = xOf(last.ts)
          const y0 = yOf(last.ratio)
          const x1 = xOf(maxTs)
          if (Math.abs(x1 - x0) < 0.5) return ''
          return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y0.toFixed(2)}`
        })()

        // Connect planned points for this habit.
        const d = planned
          .map((p, idx) => {
            const x = xOf(p.ts)
            const y = yOf(p.ratio)
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
          })
          .join(' ')

        return (
          <g key={hid + ':plannedSeries'}>
            {baselineD ? (
              <path
                d={baselineD}
                fill="none"
                stroke={color}
                opacity={0.35}
                strokeWidth={1.6}
                strokeDasharray="6 5"
              />
            ) : null}
            {d ? (
              <path
                d={d}
                fill="none"
                stroke={color}
                opacity={0.55}
                strokeWidth={1.8}
                strokeDasharray="6 5"
              />
            ) : null}

            {extensionD ? (
              <path
                d={extensionD}
                fill="none"
                stroke={color}
                opacity={0.35}
                strokeWidth={1.6}
                strokeDasharray="6 5"
              />
            ) : null}

            {planned.map((p) => {
              const cx = xOf(p.ts)
              const py = yOf(p.ratio)
              return (
                <circle
                  key={hid + ':planpt:' + p.ts}
                  cx={cx}
                  cy={py}
                  r={3}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.8}
                  opacity={0.8}
                  strokeDasharray="3 3"
                />
              )
            })}
          </g>
        )
      })}

      {/* points - for non-aggregated ranges, show individual event points */}
      {!['7d', '1mo', '1y'].includes(range) && points.map((p) => {
        const i = habitIds.indexOf(p.habitId)
        const color = palette(Math.max(0, i))
        const series = actualSeriesByHabit.get(p.habitId) ?? []
        const ratio = series.find(s => s.ts === p.ts)?.ratio ?? 0
        const x = xOf(p.ts)
        const y = yOf(ratio)
        const stroke = p.kind === 'pause' ? '#f59e0b' : undefined
        return (
          <g key={p.habitId + ':' + p.ts}>
            {/* Larger invisible hover area - bigger on mobile */}
            <circle
              cx={x}
              cy={y}
              r={isMobile ? 12 : 8}
              fill="transparent"
              onMouseEnter={(e) => showTooltip(e, p, ratio)}
              onMouseLeave={hideTooltip}
              style={{ cursor: 'pointer' }}
            />
            {/* Visible point - slightly larger on mobile */}
            <circle
              cx={x}
              cy={y}
              r={isMobile ? 4 : 3.5}
              fill={color}
              stroke={stroke}
              strokeWidth={stroke ? 1.5 : 0}
              pointerEvents="none"
            />
          </g>
        )
      })}

      {/* Daily aggregated points - for extended ranges */}
      {['7d', '1mo', '1y'].includes(range) && habitIds.map((hid, i) => {
        const actualSeries = actualSeriesByHabit.get(hid) ?? []
        const plannedSeries = plannedSeriesByHabit.get(hid) ?? []
        const color = palette(i)
        
        return (
          <g key={hid + ':dailyPoints'}>
            {/* Actual data points */}
            {actualSeries.map((point, idx) => {
              const x = xOf(point.ts)
              const y = yOf(point.ratio)
              return (
                <g key={hid + ':actual:' + point.ts}>
                  {/* Hover area */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isMobile ? 12 : 8}
                    fill="transparent"
                    onMouseEnter={(e) => {
                      // Create a synthetic event point for tooltip display
                      const syntheticPoint: EventPoint = {
                        habitId: hid,
                        ts: point.ts,
                        iso: new Date(point.ts).toISOString(),
                        kind: 'complete',
                        workloadDelta: 0,
                        workloadCumulative: point.cum,
                        workloadTotal: point.total,
                        progressDelta: 0,
                        progressCumulative: point.ratio,
                        workloadUnit: habits.find(h => h.id === hid)?.workloadUnit ?? 'work'
                      }
                      showTooltip(e, syntheticPoint, point.ratio)
                    }}
                    onMouseLeave={hideTooltip}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Visible point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isMobile ? 4 : 3.5}
                    fill={color}
                    pointerEvents="none"
                  />
                </g>
              )
            })}
            
            {/* Planned data points */}
            {plannedSeries.map((point, idx) => {
              const x = xOf(point.ts)
              const y = yOf(point.ratio)
              return (
                <g key={hid + ':planned:' + point.ts}>
                  {/* Hover area for planned points */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isMobile ? 10 : 6}
                    fill="transparent"
                    onMouseEnter={(e) => {
                      // Create a synthetic event point for planned data tooltip
                      const syntheticPoint: EventPoint = {
                        habitId: hid,
                        ts: point.ts,
                        iso: new Date(point.ts).toISOString(),
                        kind: 'complete',
                        workloadDelta: 0,
                        workloadCumulative: point.cum,
                        workloadTotal: point.total,
                        progressDelta: 0,
                        progressCumulative: point.ratio,
                        workloadUnit: habits.find(h => h.id === hid)?.workloadUnit ?? 'work'
                      }
                      
                      // Show tooltip with planned data indication
                      const habit = habits.find(h => h.id === hid)
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        content: {
                          habitName: habit?.name ?? hid,
                          kind: 'Planned',
                          timestamp: new Date(point.ts).toLocaleString(),
                          workloadDelta: 0,
                          workloadCumulative: point.cum,
                          workloadTotal: point.total,
                          workloadUnit: habit?.workloadUnit ?? 'work',
                          progressRatio: point.ratio
                        }
                      })
                    }}
                    onMouseLeave={hideTooltip}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Visible planned point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={3}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.8}
                    opacity={0.8}
                    strokeDasharray="3 3"
                    pointerEvents="none"
                  />
                </g>
              )
            })}
          </g>
        )
      })}
          </svg>
        </div>
      </div>
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="rounded border border-zinc-100 p-2 text-xs text-zinc-700 dark:border-slate-800 dark:text-zinc-200 bg-white dark:bg-slate-900 shadow-lg max-w-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <span className="font-medium">{tooltip.content.habitName}</span>
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                  {tooltip.content.kind}
                </span>
              </div>
              <div className="text-zinc-500 text-[10px]">{tooltip.content.timestamp}</div>
            </div>

            <div className="grid grid-cols-1 gap-1">
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Progress</div>
                <div className="font-semibold text-[11px]">{Math.round(tooltip.content.progressRatio * 100)}%</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Workload Cumulative</div>
                <div className="font-semibold text-[11px]">{tooltip.content.workloadCumulative} {tooltip.content.workloadUnit}</div>
              </div>
              <div className="rounded bg-zinc-50 p-1.5 dark:bg-slate-900/40">
                <div className="text-[9px] text-zinc-500">Workload Total</div>
                <div className="font-semibold text-[11px]">{tooltip.content.workloadTotal ?? '-'} {tooltip.content.workloadUnit}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}