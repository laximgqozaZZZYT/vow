"use client"

import React from 'react'

type SectionId = 'next' | 'activity' | 'calendar' | 'statics'

export default function EditLayoutModal({ open, onClose, sections, onChange, onAdd, onDelete }: { open: boolean; onClose: () => void; sections: SectionId[]; onChange: (s: SectionId[]) => void; onAdd: (id: SectionId) => void; onDelete: (id: SectionId) => void }) {
  const [local, setLocal] = React.useState<SectionId[]>(sections || [])
  const dragIdRef = React.useRef<SectionId | null>(null)

  React.useEffect(() => setLocal(sections || []), [sections, open])
  if (!open) return null

  const reorder = (list: SectionId[], fromId: SectionId, toId: SectionId) => {
    if (fromId === toId) return list
    const fromIndex = list.indexOf(fromId)
    const toIndex = list.indexOf(toId)
    if (fromIndex === -1 || toIndex === -1) return list
    const next = [...list]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  }

  const available: { id: SectionId; label: string }[] = [
    { id: 'next', label: 'Next' },
    { id: 'activity', label: 'Activity' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'statics', label: 'Statics' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-full max-w-lg rounded bg-white px-4 pt-4 pb-0 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">Edit Layout</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <div className="mt-4 flex gap-4 overflow-auto max-h-[65vh] pr-2">
          <div className="flex-1 space-y-3">
            {local.map((id) => (
              <div
                key={id}
                draggable
                onDragStart={(e) => {
                  dragIdRef.current = id
                  try { e.dataTransfer.setData('text/plain', id) } catch {}
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const from = (dragIdRef.current ?? ((): SectionId | null => {
                    try { return (e.dataTransfer.getData('text/plain') as SectionId) || null } catch { return null }
                  })()) as SectionId | null
                  if (!from) return

                  // Compute the next order from the latest local value.
                  // Important: don't call parent setState inside the functional setState updater.
                  const next = reorder(local, from, id)
                  dragIdRef.current = null
                  setLocal(next)
                }}
                onDragEnd={() => { dragIdRef.current = null }}
                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2 shadow-sm dark:border-slate-700 dark:bg-[#0b1220]"
                title="Drag to reorder"
              >
                <div className="select-none cursor-grab text-slate-400">⋮⋮</div>
                <div className="flex-1 text-sm font-medium">{available.find(a => a.id === id)?.label ?? id}</div>
                <div className="flex gap-2">
                  <button className="text-xs text-red-600" onClick={() => { onDelete(id); setLocal(l => l.filter(x => x !== id)) }}>Delete</button>
                </div>
              </div>
            ))}

            <div className="mt-2">
              <div className="text-xs text-slate-500 mb-2">Add section</div>
              <div className="flex gap-2 flex-wrap">
                {available.map(a => (
                  <button key={a.id} className="rounded border px-3 py-1 text-sm" onClick={() => { if (!local.includes(a.id)) { onAdd(a.id); setLocal(l => [...l, a.id]) } }}>{a.label}</button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button className="rounded border px-3 py-2" onClick={() => { onChange(local); onClose(); }}>Save</button>
              <button className="ml-2 rounded border px-3 py-2" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
