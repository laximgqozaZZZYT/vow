"use client"

import React from 'react'
import { DiaryTag } from '@/lib/api'

type Goal = { id: string; name: string }
type Habit = { id: string; name: string }

export default function DiaryTagManagerModal({
  open,
  onClose,
  tags,
  goals,
  habits,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  tags: DiaryTag[]
  goals?: Goal[]
  habits?: Habit[]
  onCreate: (payload: { name: string; color?: string | null }) => Promise<void>
  onUpdate: (id: string, payload: { name?: string; color?: string | null }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState<string>('')
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-full max-w-3xl rounded-lg border border-zinc-200 bg-white px-4 pt-4 pb-4 shadow-lg text-black dark:border-white/10 dark:bg-[#0a0f16] dark:text-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Manage Tags</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        {error ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-6">
          <div>
            <div className="text-xs text-zinc-500 mb-2">Tags (free)</div>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1 dark:border-white/10 dark:bg-black/20"
                style={t.color ? { borderColor: t.color } : undefined}
              >
                <input
                  className="w-44 rounded border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
                  value={t.name}
                  onChange={async (e) => {
                    const next = e.target.value
                    try {
                      setBusy(true)
                      await onUpdate(t.id, { name: next })
                      setError(null)
                    } catch (err: any) {
                      setError(String(err?.message ?? err))
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
                <input
                  className="h-7 w-10 rounded border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-transparent"
                  type="color"
                  value={t.color ?? '#8b5cf6'}
                  onChange={async (e) => {
                    try {
                      setBusy(true)
                      await onUpdate(t.id, { color: e.target.value })
                      setError(null)
                    } catch (err: any) {
                      setError(String(err?.message ?? err))
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
                <button
                  className="text-xs text-red-500 hover:underline"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true)
                      await onDelete(t.id)
                      setError(null)
                    } catch (err: any) {
                      setError(String(err?.message ?? err))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {tags.length === 0 ? <div className="text-xs text-zinc-500">No tags</div> : null}
          </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-white/10">
              <div className="text-xs text-zinc-500 mb-2">Goals (read-only)</div>
              <div className="flex flex-wrap gap-2">
                {(goals ?? []).map((g) => (
                  <span key={g.id} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs">
                    {g.name}
                  </span>
                ))}
                {(goals ?? []).length === 0 ? <div className="text-xs text-zinc-500">No goals</div> : null}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 p-3 dark:border-white/10">
              <div className="text-xs text-zinc-500 mb-2">Habits (read-only)</div>
              <div className="flex flex-wrap gap-2">
                {(habits ?? []).map((h) => (
                  <span key={h.id} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs">
                    {h.name}
                  </span>
                ))}
                {(habits ?? []).length === 0 ? <div className="text-xs text-zinc-500">No habits</div> : null}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 p-3 dark:border-white/10">
            <div className="text-xs text-zinc-500 mb-2">Add new tag</div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="w-56 rounded border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
                placeholder="Tag name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="h-8 w-12 rounded border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-transparent"
                type="color"
                value={color || '#8b5cf6'}
                onChange={(e) => setColor(e.target.value)}
              />
              <button
                className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                disabled={!name.trim() || busy}
                onClick={async () => {
                  try {
                    setBusy(true)
                    await onCreate({ name: name.trim(), color: color || undefined })
                    setName('')
                    setColor('')
                    setError(null)
                  } catch (err: any) {
                    setError(String(err?.message ?? err))
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button className="rounded border px-3 py-2" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
