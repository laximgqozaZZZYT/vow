"use client"

import React from 'react'

type Habit = { id: string; name: string; createdAt?: string | null; dueDate?: string | null; workloadUnit?: string | null; workloadTotal?: number | null; must?: number | null; workloadPerCount?: number | null }

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
  workloadUnit: string
}

type RangeKey = '24h' | '7d' | '1mo' | '1y' | 'all'

function rangeLabel(k: RangeKey) {
  if (k === '24h') return '24h'
  if (k === '7d') return '7d'
  if (k === '1mo') return '1mo'
  if (k === '1y') return '1y'
  return 'All'
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

function getRangeStartTs(range: RangeKey): number {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  if (range === '24h') return now - day
  if (range === '7d') return now - 7 * day
  if (range === '1mo') return now - 30 * day
  if (range === '1y') return now - 365 * day
  return 0
}

function palette(i: number) {
  // Tailwind-ish colors (no dependency)
  const colors = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#4b5563']
  return colors[i % colors.length]
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

function buildEventPoints(
  habits: Habit[],
  activities: Activity[],
  visibleHabitIds: string[],
  range: RangeKey,
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
    if (range !== 'all') return getRangeStartTs(range)

    // All-time means "from each habit's createdAt" ideally. We'll approximate by using
    // the earliest of (habit.createdAt, earliest activity for that habit).
    let earliest = Number.POSITIVE_INFINITY
    for (const h of habits) {
      if (!visible.has(h.id)) continue
      const t = h.createdAt ? safeTs(h.createdAt) : 0
      if (t && t < earliest) earliest = t
    }
    for (const { a, ts } of filtered) {
      if (visible.has(a.habitId) && ts < earliest) earliest = ts
    }
    return Number.isFinite(earliest) ? earliest : 0
  })()

  // We'll compute cumulative workload as sum of `amount` deltas within the selected window.
  // The app records `amount` for complete and 0 for pause; treat null as 0.
  const cumByHabit = new Map<string, number>()
  const out: EventPoint[] = []

  for (const { a, ts } of filtered) {
    if (ts < startTs) continue

    const habit = habitMap.get(a.habitId)
    const unit = (habit?.workloadUnit ?? '') || 'work'
    const total = (habit?.workloadTotal ?? habit?.must ?? null) as number | null

    const delta = (typeof a.amount === 'number' && Number.isFinite(a.amount)) ? a.amount : 0
    const prevCum = cumByHabit.get(a.habitId) ?? 0
    const nextCum = prevCum + delta
    cumByHabit.set(a.habitId, nextCum)

    out.push({
      habitId: a.habitId,
      ts,
      iso: a.timestamp,
      kind: a.kind as any,
      workloadDelta: delta,
      workloadCumulative: nextCum,
      workloadTotal: total,
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
}: {
  habits: Habit[]
  points: EventPoint[]
  visibleHabitIds: string[]
  onHover: (p: EventPoint | null) => void
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
    const maxCum = Math.max(1, ...points.map(p => p.workloadCumulative))
    return maxCum
  }, [points])

  const minTs = points.length ? Math.min(...points.map(p => p.ts)) : (Date.now() - 24 * 60 * 60 * 1000)
  const maxTs = points.length ? Math.max(...points.map(p => p.ts)) : Date.now()

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

  const plannedPaths = React.useMemo(() => {
    // Planned progress: linear from habit.createdAt (or chart start) to habit.dueDate (or chart end)
    // towards habit.workloadTotal/must.
    const res: Array<{ habitId: string; d: string; color: string }> = []

    for (let i = 0; i < habitIds.length; i++) {
      const hid = habitIds[i]
      const h = habits.find(x => x.id === hid)
      if (!h) continue

      const total = (typeof h.workloadTotal === 'number' ? h.workloadTotal : (typeof h.must === 'number' ? h.must : null))
        ?? (typeof h.workloadPerCount === 'number' ? h.workloadPerCount : null)
      if (!total || total <= 0) continue

      const start = h.createdAt ? safeTs(h.createdAt) : minTs
  const due = h.dueDate ? safeTs(h.dueDate) : maxTs
      const planStart = Math.max(minTs, start || minTs)
      const planEnd = Math.min(maxTs, (due && due > 0 ? due : maxTs))
      if (planEnd <= planStart) continue

      const x1 = xOf(planStart)
      const y1 = yOf(plannedValueAt(planStart, planEnd, total, planStart))
      const x2 = xOf(planEnd)
      const y2 = yOf(plannedValueAt(planStart, planEnd, total, planEnd))

      const color = palette(i)
      res.push({ habitId: hid, d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`, color })
    }

    return res
  }, [habits, habitIds, minTs, maxTs, yDomainMax])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" opacity={0.25} />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" opacity={0.25} />

      <text x={padding - 6} y={height - padding + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>0</text>
      <text x={padding - 6} y={padding + 4} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>{yDomainMax}</text>

      {/* lines per habit (workloadAt proxy / count) */}
      {habitIds.map((hid, i) => {
        const arr = pointsByHabit.get(hid) ?? []
        const color = palette(i)
        const d = arr
          .map((p, idx) => {
            const x = xOf(p.ts)
            const y = yOf(p.workloadCumulative)
            return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
          })
          .join(' ')
        return d ? <path key={hid} d={d} fill="none" stroke={color} strokeWidth={2} opacity={0.75} /> : null
      })}

      {/* planned guide lines (dashed) */}
      {plannedPaths.map((p) => (
        <path
          key={p.habitId + ':plan'}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={2}
          opacity={0.45}
          strokeDasharray="6 5"
        />
      ))}

      {/* points */}
      {points.map((p) => {
        const i = habitIds.indexOf(p.habitId)
        const color = palette(Math.max(0, i))
        const x = xOf(p.ts)
  const y = yOf(p.workloadCumulative)
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
  const [range, setRange] = React.useState<RangeKey>('7d')
  const [editGraphOpen, setEditGraphOpen] = React.useState(false)

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

  const eventPoints = React.useMemo(() => {
    return buildEventPoints(habits, activities as any, visibleHabitIds, range)
  }, [habits, activities, visibleHabitIds, range])

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
          {(['24h', '7d', '1mo', '1y', 'all'] as RangeKey[]).map((k) => (
            <button
              key={k}
              className={`rounded border px-2 py-1 text-xs ${range === k ? 'bg-zinc-100 dark:bg-slate-800' : ''}`}
              onClick={() => setRange(k)}
            >
              {rangeLabel(k)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded border px-2 py-1 text-sm" onClick={() => setEditGraphOpen(true)}>
            Edit Graph
          </button>
        </div>
      </div>

      <div className="mt-4">
        {eventPoints.length === 0 ? (
          <div className="text-sm text-zinc-500">No Pause/Done activity points in this range yet.</div>
        ) : (
          <div className="rounded border border-zinc-100 p-3 dark:border-slate-800">
            <MultiEventChart habits={habits} points={eventPoints} visibleHabitIds={visibleHabitIds} onHover={setHoverPoint} />

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
