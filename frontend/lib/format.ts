export function formatTime24(date: Date, opts?: { hour?: '2-digit' | 'numeric'; minute?: '2-digit' | 'numeric'; second?: '2-digit' | 'numeric' }) {
  const hour = opts?.hour ?? '2-digit'
  const minute = opts?.minute ?? '2-digit'
  const second = opts?.second
  return date.toLocaleTimeString('ja-JP', { hour, minute, second, hour12: false })
}

export function formatDateTime24(date: Date) {
  // YYYY-MM-DD HH:MM
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}
