/**
 * Chart series builder functions for MultiEventChart component
 * Handles building planned and actual data series for habit progress visualization
 */

import {
  Timing,
  ChartHabit,
  EventPoint,
  RangeKey,
  safeMinutes,
  parseYmdToDate,
  timingAppliesOnDay,
  computeAutoLoadPerTimingSet,
  getDayStart,
  getDayEnd,
  isRecurring
} from './chartUtils'

// ============================================================================
// Types
// ============================================================================

export type PlannedSeriesPoint = { ts: number; v: number }
export type DailySeriesPoint = { ts: number; ratio: number; cum: number; total: number }

// ============================================================================
// Planned Series Builder
// ============================================================================

/**
 * Synthesize default timings when habit has no explicit timing rows
 */
function synthesizeDefaultTimings(habit: ChartHabit): Timing[] {
  const start = (habit.time ?? undefined) as string | undefined
  const end = (habit.endTime ?? undefined) as string | undefined
  const sm = safeMinutes(start)
  const em = safeMinutes(end)
  
  if (sm !== null) {
    return [{ type: 'Daily', start: start, end: (em !== null ? end : undefined) }]
  }
  // last resort: assume a daily occurrence sometime in the day
  return [{ type: 'Daily', start: '00:00', end: '00:00' }]
}

/**
 * Get applicable timing indices for a specific day
 */
function getApplicableTimingIndices(timings: Timing[], dayTs: number): number[] {
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
  
  return idxs
}

/**
 * Build planned series for a single habit
 * Calculates expected progress based on workload and timing configuration
 */
export function buildPlannedSeriesForHabit(
  h: ChartHabit,
  minTs: number,
  maxTs: number
): PlannedSeriesPoint[] {
  const startTs = Number.isFinite(minTs) ? minTs : 0
  const endTs = Number.isFinite(maxTs) ? maxTs : Date.now()
  if (endTs <= startTs) return []

  // Get workload total per day
  const workloadTotalDay = (typeof h.workloadTotal === 'number' && Number.isFinite(h.workloadTotal))
    ? h.workloadTotal
    : ((typeof h.must === 'number' && Number.isFinite(h.must)) ? h.must : null)
  if (workloadTotalDay === null || workloadTotalDay <= 0) return []
  const perDayTarget = workloadTotalDay

  // Get or synthesize timings
  let timings = (Array.isArray((h as any).timings) ? ((h as any).timings as Timing[]) : [])
  if (!timings.length) {
    timings = synthesizeDefaultTimings(h)
  }
  const autoLoads = computeAutoLoadPerTimingSet(workloadTotalDay, timings)

  // Set up day iteration
  const startDay = new Date(startTs)
  startDay.setHours(0, 0, 0, 0)
  const endDay = new Date(endTs)
  endDay.setHours(0, 0, 0, 0)

  let cum = 0
  const series: PlannedSeriesPoint[] = []

  // Iterate through each day in the range
  for (let dayTs = startDay.getTime(); dayTs <= endDay.getTime(); dayTs += 24 * 60 * 60_000) {
    const idxs = getApplicableTimingIndices(timings, dayTs)
    if (!idxs.length) continue

    // Scale daily total if not all timing rows apply
    const loadsRaw = idxs.map(i => autoLoads[i] ?? 0)
    const sumRaw = loadsRaw.reduce((a, b) => a + b, 0)
    const scale = sumRaw > 0 ? (perDayTarget / sumRaw) : 1

    // Add points for each applicable timing
    for (let j = 0; j < idxs.length; j++) {
      const i = idxs[j]
      const t = timings[i]
      if (!t) continue

      const endMinRaw = safeMinutes(t.end)
      const ts = endMinRaw !== null
        ? (dayTs + endMinRaw * 60_000)
        : (dayTs + 24 * 60 * 60_000)

      cum += (autoLoads[i] ?? 0) * scale
      if (ts >= startTs && ts <= endTs) series.push({ ts, v: cum })
    }
  }

  if (!series.length) return []

  // Sort and deduplicate by timestamp
  series.sort((a, b) => a.ts - b.ts)
  const dedup: PlannedSeriesPoint[] = []
  for (const p of series) {
    const last = dedup[dedup.length - 1]
    if (!last || last.ts !== p.ts) dedup.push(p)
    else last.v = Math.max(last.v, p.v)
  }
  return dedup
}

// ============================================================================
// Daily Aggregated Series Builder
// ============================================================================

/**
 * Calculate total expected progress for a habit over a range
 */
function calculateTotalExpectedForRange(
  habit: ChartHabit,
  effectiveStartTs: number,
  maxTs: number,
  workloadTotalDay: number | null
): number {
  if (workloadTotalDay && workloadTotalDay > 0) {
    const plannedSeries = buildPlannedSeriesForHabit(habit, effectiveStartTs, maxTs)
    return plannedSeries.length > 0 ? Math.max(0, ...plannedSeries.map(p => p.v)) : 0
  }
  
  // For habits without workload total, calculate based on daily occurrences
  const timings = (Array.isArray((habit as any).timings) ? ((habit as any).timings as Timing[]) : [])
  
  if (!timings.length) {
    // Default to daily if no timings specified
    return Math.ceil((maxTs - effectiveStartTs) / (24 * 60 * 60_000))
  }
  
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
  return expectedOccurrences
}

/**
 * Calculate daily actual progress from event points
 */
function calculateDailyActual(
  dayPoints: EventPoint[],
  workloadTotalDay: number | null
): number {
  let dailyActual = 0
  for (const point of dayPoints) {
    if (workloadTotalDay && workloadTotalDay > 0) {
      dailyActual += point.workloadDelta
    } else {
      dailyActual += (point.kind === 'complete' ? 1 : 0)
    }
  }
  return dailyActual
}

/**
 * Calculate cumulative planned progress up to a specific day
 */
function calculateCumulativePlanned(
  habit: ChartHabit,
  effectiveStartTs: number,
  dayEnd: number,
  currentCumulativePlanned: number,
  workloadTotalDay: number | null,
  dayStart: number
): number {
  if (workloadTotalDay && workloadTotalDay > 0) {
    const plannedSeries = buildPlannedSeriesForHabit(habit, effectiveStartTs, dayEnd)
    return plannedSeries.length > 0 ? Math.max(0, ...plannedSeries.map(p => p.v)) : 0
  }
  
  // For habits without workload total, check if this day should have an occurrence
  const day = new Date(dayStart)
  const timings = (Array.isArray((habit as any).timings) ? ((habit as any).timings as Timing[]) : [])
  
  if (!timings.length) {
    return currentCumulativePlanned + 1
  }
  
  for (const timing of timings) {
    if (timingAppliesOnDay(timing, day)) {
      return currentCumulativePlanned + 1
    }
  }
  return currentCumulativePlanned
}

/**
 * Build daily aggregated series for multiple habits
 * Used for extended time ranges (7d, 1mo, 1y)
 */
export function buildDailyAggregatedSeries(
  habits: ChartHabit[],
  points: EventPoint[],
  visibleHabitIds: string[],
  minTs: number,
  maxTs: number,
  range: RangeKey
): {
  actualSeriesByHabit: Map<string, DailySeriesPoint[]>
  plannedSeriesByHabit: Map<string, DailySeriesPoint[]>
} {
  const actualSeriesByHabit = new Map<string, DailySeriesPoint[]>()
  const plannedSeriesByHabit = new Map<string, DailySeriesPoint[]>()
  
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
    
    const habitCreatedTs = habit.createdAt ? new Date(habit.createdAt).getTime() : minTs
    const effectiveStartTs = Math.max(habitCreatedTs, minTs)
    
    const workloadTotalDay = (typeof habit.workloadTotal === 'number' && Number.isFinite(habit.workloadTotal))
      ? habit.workloadTotal
      : ((typeof habit.must === 'number' && Number.isFinite(habit.must)) ? habit.must : null)
    
    const totalExpectedForRange = calculateTotalExpectedForRange(habit, effectiveStartTs, maxTs, workloadTotalDay)
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
    const actualDailySeries: DailySeriesPoint[] = []
    const plannedDailySeries: DailySeriesPoint[] = []
    
    let cumulativeActual = 0
    let cumulativePlanned = 0
    
    for (const dayStart of dailyTimestamps) {
      const dayEnd = getDayEnd(dayStart)
      
      // Skip days before habit creation
      if (dayEnd < habitCreatedTs) continue
      
      // Calculate actual progress for this day
      const dayPoints = actualPointsByDay.get(dayStart) ?? []
      cumulativeActual += calculateDailyActual(dayPoints, workloadTotalDay)
      
      // Calculate planned progress for this day
      cumulativePlanned = calculateCumulativePlanned(
        habit, effectiveStartTs, dayEnd, cumulativePlanned, workloadTotalDay, dayStart
      )
      
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
