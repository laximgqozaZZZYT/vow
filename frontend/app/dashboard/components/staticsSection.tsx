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

type Activity = {
  id: string
  kind: string
  habitId: string
  timestamp: string
  amount?: number | null
  newCount?: number | null
  prevCount?: number | null
  durationSeconds?: number | null
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

function toLocalDatetimeValue(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  // For <input type="datetime-local">: YYYY-MM-DDTHH:mm (no seconds)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalDatetimeValue(v: string) {
  // Interpreted in local timezone by Date constructor.
  const ts = new Date(v).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function rangeLabel(k: RangeKey) {
  if (k === 'auto') return 'Auto'
  if (k === '24h') return '24h'
  if (k === '7d') return '7d'
  if (k === '1mo') return '1mo'
  if (k === '1y') return '1y'
  return 'Auto'
}

function isoDay(ts: string) {
  try { return new Date(ts).toISOString().slice(0, 10) } catch { return '' }
}

function buildDailyCountSeries(activities: Activity[], habitId: string): Point[] {
  const map = new Map<string, number>()

  for (const a of activities) {
    if (a.habitId !== habitId) continue
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

function safeTs(iso: string): number {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
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

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function clipToDayWindow(s: Date, e: Date, startMin: number, endMin: number) {
  const day = new Date(s)
  day.setHours(0, 0, 0, 0)
  const winS = new Date(day.getTime() + startMin * 60_000)
  const winE = new Date(day.getTime() + endMin * 60_000)
  const ss = new Date(Math.max(s.getTime(), winS.getTime()))
  const ee = new Date(Math.min(e.getTime(), winE.getTime()))
  if (ee.getTime() <= ss.getTime()) return null
  return { start: ss, end: ee }
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

function outdateAppliesOnDay(od: Timing, day: Date): boolean {
  if (od.type === 'Daily') return true
  if (od.type === 'Date') {
    const d = parseYmdToDate(od.date)
    if (!d) return false
    return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
  }
  if (od.type === 'Weekly') {
    const days = getWeeklyAllowedWeekdays(od)
    if (days === null) return true
    return days.includes(day.getDay())
  }
  if (od.type === 'Monthly') {
    const d = parseYmdToDate(od.date)
    if (!d) return true
    return d.getDate() === day.getDate()
  }
  return false
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

function computeCustomTodayWindow() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const from = d.getTime()
  // default until: today 23:59 (not tomorrow 00:00)
  const until = from + (24 * 60 - 1) * 60_000
  return { from, until }
}

function sliceLatestNPoints(points: EventPoint[], n: number): EventPoint[] {
  if (points.length <= n) return points
  // Points are already sorted ascending by ts; keep the last N.
  return points.slice(points.length - n)
}

function palette(i: number) {
  // Tailwind-ish colors (no dependency)
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4b5563']
  return colors[i % colors.length]
}

function isRecurring(repeat: string | null | undefined) {
  if (!repeat) return false
  const r = repeat.trim().toLowerCase()
  if (!r) return false
  // Treat explicit "none" values as non-recurring.
  return r !== 'none' && r !== 'no' && r !== 'false' && r !== '0' && r !== 'does not repeat'
}

function clamp01(x: number) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return x
}

function plannedValueAt(
  startTs: number,
  endTs: number,
  target: number,
  ts: number,
) {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return 0
  const t = clamp01((ts - startTs) / (endTs - startTs))
  return target * t
}

function plannedCumulativeAtTs(
  h: Habit,
  startTs: number,
  ts: number,
) {
  // Compute planned cumulative workload "as if the schedule was completed" up to `ts`.
  // We reuse the planned series builder and take the last point <= ts.
  const series = buildPlannedSeriesForHabit(h as any, startTs, ts)
  if (!series.length) return 0
  let v = 0
  for (const p of series) {
    if (p.ts <= ts) v = p.v
    else break
  }
  return v
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
    .filter(a => visible.has(a.habitId))
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

  // We'll compute cumulative workload as sum of `amount` deltas within the selected window.
  // The app records `amount` for complete and 0 for pause; treat null as 0.
  const cumByHabit = new Map<string, number>()
  const out: EventPoint[] = []

  for (const { a, ts } of filtered) {
    if (ts < startTs) continue
    if (ts > endTs) continue

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
      iso: a.timestamp,
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

function MultiEventChart({
  habits,
  points,
  visibleHabitIds,
  onHover,
  range,
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  onHover: (p: EventPoint | null) => void
  range: RangeKey
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

  const domain = React.useMemo(() => computeDomainTs(range, points), [range, points])
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
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
            <circle
              cx={x}
              cy={y}
              r={3.5}
              fill={color}
              stroke={stroke}
              strokeWidth={stroke ? 1.5 : 0}
              onMouseEnter={() => onHover(p)}
              onMouseLeave={() => onHover(null)}
            />
          </g>
        )
      })}
    </svg>
  )
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
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

export default function StaticsSection({ habits, activities }: { habits: Habit[]; activities: Activity[] }) {
  // Carousel (we'll add more stat pages later)
  const pages = React.useMemo(() => ([
    { id: 'counts', title: 'Counts vs Time' },
  ] as const), [])
  const [pageIndex, setPageIndex] = React.useState(0)

  // Graph controls
  const [range, setRange] = React.useState<RangeKey>('auto')
  const [editGraphOpen, setEditGraphOpen] = React.useState(false)

  const [{ fromTs, untilTs }, setCustomWindow] = React.useState(() => {
    const w = computeCustomTodayWindow()
    return { fromTs: w.from, untilTs: w.until }
  })

  const [hoverPoint, setHoverPoint] = React.useState<EventPoint | null>(null)

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

  const baseEventPoints = React.useMemo(() => {
    // If user picked custom window, always filter by it.
    const custom = Number.isFinite(fromTs) && Number.isFinite(untilTs) && untilTs > fromTs
      ? { fromTs, untilTs }
      : undefined

    // When a custom window exists, it overrides the preset range.
    return buildEventPoints(habits, activities as any, visibleHabitIds, range, custom)
  }, [habits, activities, visibleHabitIds, range, fromTs, untilTs])

  const eventPoints = baseEventPoints

  const hasAnyRecurringVisibleHabit = React.useMemo(() => {
    const visible = new Set(visibleHabitIds)
    return habits.some(h => visible.has(h.id) && isRecurring(h.repeat))
  }, [habits, visibleHabitIds])

  return (
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Statics</h2>
          <div className="text-xs text-zinc-500">Stats & charts</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-40"
            disabled={pageIndex <= 0}
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            title="Previous"
          >
            ←
          </button>
          <div className="text-sm font-medium">{pages[pageIndex]?.title ?? 'Stats'}</div>
          <button
            className="rounded border px-2 py-1 text-sm disabled:opacity-40"
            disabled={pageIndex >= pages.length - 1}
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            title="Next"
          >
            →
          </button>
        </div>
      </div>

      {/* Controls (apply to current page) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-zinc-500">Range</div>
          {(['auto', '24h', '7d', '1mo', '1y'] as RangeKey[]).map((k) => (
            <button
              key={k}
              className={`rounded border px-2 py-1 text-xs ${range === k ? 'bg-zinc-100 dark:bg-slate-800' : ''}`}
              onClick={() => {
                setRange(k)
                const now = Date.now()
                const w = computeRangeWindow(k, now)
                setCustomWindow({ fromTs: w.fromTs, untilTs: w.untilTs })
              }}
            >
              {rangeLabel(k)}
            </button>
          ))}

          <div className="ml-2 flex items-center gap-2">
            <div className="text-xs text-zinc-500">from</div>
            <input
              className="rounded border px-2 py-1 text-xs"
              type="datetime-local"
              lang="en-GB"
              step={60}
              value={toLocalDatetimeValue(fromTs)}
              onChange={(e) => {
                const next = fromLocalDatetimeValue(e.target.value)
                setCustomWindow((prev) => ({ ...prev, fromTs: next }))
              }}
            />
            <div className="text-xs text-zinc-500">until</div>
            <input
              className="rounded border px-2 py-1 text-xs"
              type="datetime-local"
              lang="en-GB"
              step={60}
              value={toLocalDatetimeValue(untilTs)}
              onChange={(e) => {
                const next = fromLocalDatetimeValue(e.target.value)
                setCustomWindow((prev) => ({ ...prev, untilTs: next }))
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditGraphOpen(true)}>
            Edit Graph
          </button>
        </div>
      </div>

      <div className="mt-4">
        {eventPoints.length === 0 && !hasAnyRecurringVisibleHabit ? (
          <div className="text-sm text-zinc-500">No Pause/Done activity points in this range yet.</div>
        ) : (
          <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
            <MultiEventChart habits={habits} points={eventPoints} visibleHabitIds={visibleHabitIds} onHover={setHoverPoint} range={range} />

            {hoverPoint ? (
              <div className="mt-2 rounded border border-zinc-100 p-2 text-xs text-zinc-700 dark:border-slate-800 dark:text-zinc-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{habits.find(h => h.id === hoverPoint.habitId)?.name ?? hoverPoint.habitId}</span>
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">{hoverPoint.kind === 'pause' ? 'Pause' : 'Done'}</span>
                  </div>
                  <div className="text-zinc-500">{new Date(hoverPoint.ts).toLocaleString()}</div>
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded bg-zinc-50 p-2 dark:bg-slate-900/40">
                    <div className="text-[10px] text-zinc-500">Workload (this point)</div>
                    <div className="font-semibold">{hoverPoint.workloadDelta} {hoverPoint.workloadUnit}</div>
                  </div>
                  <div className="rounded bg-zinc-50 p-2 dark:bg-slate-900/40">
                    <div className="text-[10px] text-zinc-500">WorkLoad Cumulative</div>
                    <div className="font-semibold">{hoverPoint.workloadCumulative} {hoverPoint.workloadUnit}</div>
                  </div>
                  <div className="rounded bg-zinc-50 p-2 dark:bg-slate-900/40">
                    <div className="text-[10px] text-zinc-500">WorkLoad Total</div>
                    <div className="font-semibold">{hoverPoint.workloadTotal ?? '-'} {hoverPoint.workloadUnit}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
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

            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-3 py-2" onClick={() => setEditGraphOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
