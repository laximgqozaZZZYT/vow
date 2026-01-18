/**
 * Chart utility functions for MultiEventChart component
 * Extracted from Widget.MultiEventChart.tsx for better maintainability
 */

// ============================================================================
// Types
// ============================================================================

export type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly'

export type Timing = {
  id?: string
  type: TimingType
  date?: string
  start?: string
  end?: string
  cron?: string
}

export type ChartHabit = {
  id: string
  name: string
  createdAt?: string | null
  dueDate?: string | null
  repeat?: string | null
  timings?: Timing[] | null
  outdates?: Timing[] | null
  time?: string | null
  endTime?: string | null
  workloadUnit?: string | null
  workloadTotal?: number | null
  must?: number | null
  workloadPerCount?: number | null
}

export type EventPoint = {
  habitId: string
  ts: number
  iso: string
  kind: 'pause' | 'complete'
  workloadDelta: number
  workloadCumulative: number
  workloadTotal: number | null
  progressDelta: number
  progressCumulative: number
  workloadUnit: string
}

export type RangeKey = 'auto' | '24h' | '7d' | '1mo' | '1y'

// ============================================================================
// Time Parsing Utilities
// ============================================================================

/**
 * Parse time string (HH:MM) to minutes from midnight
 */
export function safeMinutes(s?: string): number | null {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * Parse YYYY-MM-DD string to Date object
 */
export function parseYmdToDate(s?: string | null): Date | null {
  if (!s) return null
  const parts = String(s).split('-').map(x => Number(x))
  if (parts.length >= 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0)
  }
  const d = new Date(String(s))
  return Number.isFinite(d.getTime()) ? d : null
}

// ============================================================================
// Timing Utilities
// ============================================================================

/**
 * Extract allowed weekdays from Weekly timing cron string
 */
export function getWeeklyAllowedWeekdays(t: Timing): number[] | null {
  const cron = (t.cron ?? '').trim()
  if (cron && cron.startsWith('WEEKDAYS:')) {
    const list = cron.split(':')[1] || ''
    const days = list.split(',').map(x => Number(x)).filter(n => !Number.isNaN(n))
    return days.length ? days : []
  }
  return null
}

/**
 * Check if a timing applies on a specific day
 */
export function timingAppliesOnDay(t: Timing, day: Date): boolean {
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

/**
 * Calculate duration in minutes between start and end times
 */
export function durationMinutes(start?: string, end?: string): number {
  const sm = safeMinutes(start)
  const em = safeMinutes(end)
  if (sm === null || em === null) return 0
  const d = em - sm
  return d > 0 ? d : 0
}

/**
 * Compute auto load per timing set based on duration ratios
 */
export function computeAutoLoadPerTimingSet(workloadTotalDay: number, timings: Timing[]): number[] {
  const durs = timings.map(t => durationMinutes(t.start, t.end))
  const sum = durs.reduce((a, b) => a + b, 0)
  const n = Math.max(1, timings.length)
  if (sum <= 0) return timings.map(() => workloadTotalDay / n)
  return durs.map(d => workloadTotalDay * (d / sum))
}

// ============================================================================
// Day Boundary Utilities
// ============================================================================

/**
 * Get timestamp for start of day (00:00:00.000)
 */
export function getDayStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * Get timestamp for end of day (23:59:59.999)
 */
export function getDayEnd(ts: number): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

// ============================================================================
// Range Utilities
// ============================================================================

/**
 * Get start timestamp for a given range key
 */
export function getRangeStartTs(range: RangeKey): number {
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

// ============================================================================
// Habit Utilities
// ============================================================================

/**
 * Check if a habit is recurring
 */
export function isRecurring(repeat: string | null | undefined): boolean {
  if (!repeat) return false
  const r = repeat.trim().toLowerCase()
  if (!r) return false
  if (r === 'none' || r === 'no' || r === 'false') return false
  return true
}

/**
 * Get color from palette by index
 */
export function palette(i: number): string {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
  return colors[i % colors.length]
}
