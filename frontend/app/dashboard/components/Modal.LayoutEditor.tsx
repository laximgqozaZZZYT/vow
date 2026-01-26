"use client"

import React from 'react'
import { useLocale } from '@/contexts/LocaleContext'
import { useHandedness } from '../contexts/HandednessContext'

type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary' | 'stickies' | 'mindmap' | 'notices' | 'coach'

export default function EditLayoutModal({ open, onClose, sections, onChange, onAdd, onDelete }: { open: boolean; onClose: () => void; sections: SectionId[]; onChange: (s: SectionId[]) => void; onAdd: (id: SectionId) => void; onDelete: (id: SectionId) => void }) {
  const [local, setLocal] = React.useState<SectionId[]>(sections || [])
  const dragIdRef = React.useRef<SectionId | null>(null)
  const { locale, setLocale } = useLocale()
  const { handedness, setHandedness, isLeftHanded } = useHandedness()

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
    { id: 'diary', label: 'Diary' },
    { id: 'stickies', label: 'Sticky\'n' },
    { id: 'mindmap', label: 'Mind Map' },
    { id: 'notices', label: 'Notices' },
    { id: 'coach', label: 'AI Coach' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg text-card-foreground flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-xl font-semibold">Edit Layout</h3>
          <button onClick={onClose} className="inline-flex items-center justify-center rounded-md w-8 h-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">✕</button>
        </div>

        <div className="p-6 space-y-6 overflow-auto max-h-[65vh]">
          {/* Locale Settings */}
          <div className="p-4 rounded-lg border border-border bg-muted">
            <div className="mb-3">
              <span className="text-sm font-medium">Language / 言語</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background p-1">
              <button 
                onClick={() => setLocale('en')}
                className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-sm rounded-md transition-colors ${
                  locale === 'en' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                aria-label="Switch to English"
                aria-pressed={locale === 'en'}
              >
                English
              </button>
              <button 
                onClick={() => setLocale('ja')}
                className={`flex-1 inline-flex items-center justify-center px-3 py-2 text-sm rounded-md transition-colors ${
                  locale === 'ja' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                aria-label="Switch to Japanese"
                aria-pressed={locale === 'ja'}
              >
                日本語
              </button>
            </div>
          </div>

          {/* Handedness Settings */}
          <div className="p-4 rounded-lg border border-border bg-muted">
            <div className="mb-3">
              <span className="text-sm font-medium">{locale === 'ja' ? 'サイドバー位置' : 'Sidebar Position'}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-background p-1">
              <button 
                onClick={() => setHandedness('left')}
                className={`flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  isLeftHanded 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                aria-label={locale === 'ja' ? '左側に配置' : 'Position on left'}
                aria-pressed={isLeftHanded}
              >
                ←Left
              </button>
              <button 
                onClick={() => setHandedness('right')}
                className={`flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  !isLeftHanded 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                aria-label={locale === 'ja' ? '右側に配置' : 'Position on right'}
                aria-pressed={!isLeftHanded}
              >
                Right→
              </button>
            </div>
          </div>

          {/* Section Layout */}
          <div>
            <div className="mb-3">
              <span className="text-sm font-medium">Dashboard Sections</span>
            </div>
            <div className="space-y-2">{local.map((id) => (
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
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-sm hover:bg-accent transition-colors"
                title="Drag to reorder"
              >
                <div className="select-none cursor-grab text-muted-foreground">⋮⋮</div>
                <div className="flex-1 text-sm font-medium">{available.find(a => a.id === id)?.label ?? id}</div>
                <div className="flex gap-2">
                  <button className="text-xs text-destructive hover:underline" onClick={() => { onDelete(id); setLocal(l => l.filter(x => x !== id)) }}>Delete</button>
                </div>
              </div>
            ))}
            </div>

            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">Add section</div>
              <div className="flex gap-2 flex-wrap">
                {available.map(a => (
                  <button 
                    key={a.id} 
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={() => { if (!local.includes(a.id)) { onAdd(a.id); setLocal(l => [...l, a.id]) } }}
                    disabled={local.includes(a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-border">
          <button 
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button 
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" 
            onClick={() => { onChange(local); onClose(); }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
