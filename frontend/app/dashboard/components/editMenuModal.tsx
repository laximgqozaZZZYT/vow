"use client"

import React from 'react'

type MenuSection = { id: string; title: string; subtitle?: string; value?: string };

export default function EditMenuModal({ open, onClose, sections, onChange, onAdd, onDelete, onMove }: { open: boolean; onClose: () => void; sections: MenuSection[]; onChange: (s: MenuSection[]) => void; onAdd: (title: string) => void; onDelete: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void }) {
  const [local, setLocal] = React.useState<MenuSection[]>(sections || [])

  React.useEffect(() => {
    setLocal(sections || [])
  }, [sections, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-full max-w-lg rounded bg-white px-4 pt-4 pb-0 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">Edit Menu</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        <div className="mt-4 flex gap-4 overflow-auto max-h-[65vh] pr-2">
          <div className="flex-1 space-y-3">
            {local.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <input className="w-full rounded border px-2 py-1" value={s.title} onChange={(e) => setLocal(ls => ls.map(l => l.id === s.id ? { ...l, title: e.target.value } : l))} />
                  <input className="w-full mt-1 rounded border px-2 py-1 text-xs" value={s.subtitle ?? ''} onChange={(e) => setLocal(ls => ls.map(l => l.id === s.id ? { ...l, subtitle: e.target.value } : l))} />
                </div>
                <div className="flex flex-col gap-1">
                  <button className="text-xs rounded border px-2 py-1" onClick={() => onMove(s.id, -1)}>↑</button>
                  <button className="text-xs rounded border px-2 py-1" onClick={() => onMove(s.id, 1)}>↓</button>
                  <button className="text-xs text-red-600" onClick={() => onDelete(s.id)}>Delete</button>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <input id="editMenuNewTitle" placeholder="New section title" className="flex-1 rounded border px-2 py-1" />
              <button className="rounded bg-sky-600 px-3 py-1 text-white" onClick={() => {
                const el = document.getElementById('editMenuNewTitle') as HTMLInputElement | null;
                if (el && el.value.trim()) { onAdd(el.value.trim()); el.value = '' }
              }}>Add</button>
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
