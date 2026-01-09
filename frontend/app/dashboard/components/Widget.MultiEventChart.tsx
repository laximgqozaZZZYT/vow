"use client"

import React from 'react'

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

function computeDomainTs(range: RangeKey, points: EventPoint[]): { minTs: number; maxTs: number } {
  const now = Date.now()
  if (range === 'auto') {
    // Auto: today window
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    const start = d.getTime()
    // Domain uses [00:00 .. 24:00) so the chart reaches the end of day.
    const end = start + 24 * 60 * 60_000
    return { minTs: start, maxTs: end }
  }
  return { minTs: getRangeStartTs(range), maxTs: now }
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
  window,
  onEditGraph,
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  onHover: (p: EventPoint | null) => void
  range: RangeKey
  window?: { fromTs: number; untilTs: number }
  onEditGraph?: () => void
}) {
  const width = 860
  const height = 220
  const padding = 30
  const innerW = width - padding * 2
  const innerH = height - padding * 2

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
    if (window && Number.isFinite(window.fromTs) && Number.isFinite(window.untilTs) && window.untilTs > window.fromTs) {
      return { minTs: window.fromTs, maxTs: window.untilTs }
    }
    return computeDomainTs(range, points)
  }, [range, points, window?.fromTs, window?.untilTs])
  const minTs = domain.minTs
  const maxTs = domain.maxTs

  const xOf = (ts: number) => {
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs) || minTs === maxTs) return padding
    return padding + innerW * ((ts - minTs) / (maxTs - minTs))
  }
  const yOf = (v: number) => padding + innerH * (1 - v / yDomainMax)

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
  }, [habitIds, habits, minTs, maxTs])

  const actualSeriesByHabit = React.useMemo(() => {
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
  }, [habitIds, plannedSeriesByHabit, pointsByHabit])

  return (
    <div className="space-y-3 w-full overflow-hidden">
      {/* Header with Edit Graph button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
          Habit Progress Timeline (Actual vs Planned)
        </h3>
        {onEditGraph && (
          <button 
            className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
            onClick={onEditGraph}
          >
            Edit Graph
          </button>
        )}
      </div>
      
      {/* Chart */}
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity={0.25} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity={0.25} />

      {/* y-axis numeric labels removed by request */}

      {/* lines per habit (workloadAt proxy / count) */}
      {habitIds.map((hid, i) => {
        const arr = actualSeriesByHabit.get(hid) ?? []
        const color = palette(i)
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

      {/* points */}
      {points.map((p) => {
        const i = habitIds.indexOf(p.habitId)
        const color = palette(Math.max(0, i))
        const series = actualSeriesByHabit.get(p.habitId) ?? []
        const ratio = series.find(s => s.ts === p.ts)?.ratio ?? 0
        const x = xOf(p.ts)
        const y = yOf(ratio)
        const stroke = p.kind === 'pause' ? '#f59e0b' : undefined
        return (
          <g key={p.habitId + ':' + p.ts}>
            {/* Larger invisible hover area */}
            <circle
              cx={x}
              cy={y}
              r={8}
              fill="transparent"
              onMouseEnter={() => onHover(p)}
              onMouseLeave={() => onHover(null)}
              style={{ cursor: 'pointer' }}
            />
            {/* Visible point */}
            <circle
              cx={x}
              cy={y}
              r={3.5}
              fill={color}
              stroke={stroke}
              strokeWidth={stroke ? 1.5 : 0}
              pointerEvents="none"
            />
          </g>
        )
      })}
      </svg>
      </div>
    </div>
  )
}