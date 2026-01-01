"use client"

import React from 'react'

type SectionId = 'next' | 'activity' | 'calendar' | 'goals'

export default function EditLayoutModal({ open, onClose, sections, onChange, onAdd, onDelete, onMove }: { open: boolean; onClose: () => void; sections: SectionId[]; onChange: (s: SectionId[]) => void; onAdd: (id: SectionId) => void; onDelete: (id: SectionId) => void; onMove: (id: SectionId, dir: -1 | 1) => void }) {
  const [local, setLocal] = React.useState<SectionId[]>(sections || [])

  React.useEffect(() => setLocal(sections || []), [sections, open])
  if (!open) return null

  const available: { id: SectionId; label: string }[] = [
    { id: 'next', label: 'Next' },
    { id: 'activity', label: 'Activity' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'goals', label: 'Goals' },
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
              <div key={id} className="flex items-center gap-2">
                <div className="flex-1 text-sm font-medium">{available.find(a => a.id === id)?.label ?? id}</div>
                <div className="flex gap-2">
                  <button className="text-xs rounded border px-2 py-1" onClick={() => { onMove(id, -1); setLocal(l => {
                    const i = l.indexOf(id); if (i <= 0) return l; const n = [...l]; const [it] = n.splice(i,1); n.splice(i-1,0,it); return n;
                  })}}>↑</button>
                  <button className="text-xs rounded border px-2 py-1" onClick={() => { onMove(id, 1); setLocal(l => {
                    const i = l.indexOf(id); if (i === -1 || i >= l.length-1) return l; const n = [...l]; const [it] = n.splice(i,1); n.splice(i+1,0,it); return n;
                  })}}>↓</button>
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
