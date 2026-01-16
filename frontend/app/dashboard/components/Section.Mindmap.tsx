"use client"

import React from 'react'
import api from '@/lib/api'
import { debug } from '@/lib/debug'
import { useHandedness } from '../contexts/HandednessContext'
import WidgetMindmap from './Widget.Mindmap'

type Goal = { id: string; name: string }

interface Mindmap {
  id: string
  name: string
  nodes: any[]
  edges: any[]
  createdAt?: string
  updatedAt?: string
}

export default function MindmapSection({ 
  goals 
}: { 
  goals: Goal[]
}) {
  const { isLeftHanded } = useHandedness()
  const [mindmaps, setMindmaps] = React.useState<Mindmap[]>([])
  const [selectedMindmap, setSelectedMindmap] = React.useState<Mindmap | null>(null)
  const [openMindmap, setOpenMindmap] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')

  const refreshMindmaps = React.useCallback(async (searchQuery?: string) => {
    setLoading(true)
    try {
      debug.log('[Section.Mindmap] Starting to fetch mindmaps...')
      const m = await api.getMindmaps()
      debug.log('[Section.Mindmap] Successfully fetched', m?.length || 0, 'mindmaps')
      
      // Filter mindmaps based on search query
      let filteredMindmaps = m
      if (searchQuery && searchQuery.trim()) {
        const lowerQuery = searchQuery.toLowerCase()
        filteredMindmaps = m.filter((mindmap: Mindmap) => {
          const name = (mindmap.name || '').toLowerCase()
          return name.includes(lowerQuery)
        })
      }
      
      setMindmaps(filteredMindmaps)
      setError(null)
    } catch (e: any) {
      console.error('[Section.Mindmap] Error fetching mindmaps:', e)
      const errorMessage = String(e?.body ?? e?.message ?? e)
      console.error('[Section.Mindmap] Error message:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshMindmaps(query)
  }, [refreshMindmaps, query])

  const openNew = () => {
    setSelectedMindmap(null)
    setOpenMindmap(true)
  }

  const openEdit = (mindmap: Mindmap) => {
    setSelectedMindmap(mindmap)
    setOpenMindmap(true)
  }

  const handleSave = async (mindmapData: any) => {
    try {
      debug.log('[Section.Mindmap] Saving mindmap:', mindmapData)
      
      if (mindmapData.id) {
        // Update existing mindmap
        debug.log('[Section.Mindmap] Updating existing mindmap:', mindmapData.id)
        const updatedMindmap = await api.updateMindmap(mindmapData.id, {
          name: mindmapData.name,
          nodes: mindmapData.nodes,
          edges: mindmapData.edges
        })
        setMindmaps((prev) => prev.map(m => m.id === mindmapData.id ? updatedMindmap : m))
        debug.log('[Section.Mindmap] Mindmap updated successfully:', updatedMindmap)
      } else {
        // Create new mindmap
        debug.log('[Section.Mindmap] Creating new mindmap')
        const newMindmap = await api.createMindmap({
          name: mindmapData.name,
          nodes: mindmapData.nodes,
          edges: mindmapData.edges
        })
        setMindmaps((prev) => [...prev, newMindmap])
        setSelectedMindmap(newMindmap)
        debug.log('[Section.Mindmap] Mindmap created successfully:', newMindmap)
      }
      
      await refreshMindmaps(query)
    } catch (error) {
      console.error('[Section.Mindmap] Failed to save mindmap:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      throw error
    }
  }

  const handleDelete = async (mindmapId: string) => {
    if (!confirm('Delete this mindmap?')) return
    
    try {
      await api.deleteMindmap(mindmapId)
      setMindmaps((prev) => prev.filter(m => m.id !== mindmapId))
      debug.log('[Section.Mindmap] Mindmap deleted successfully')
    } catch (error) {
      console.error('[Section.Mindmap] Failed to delete mindmap:', error)
    }
  }

  return (
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Mind Map</h2>
        <div className={`flex flex-wrap items-center gap-2 ${isLeftHanded ? 'justify-start' : 'justify-end'}`}>
          <input
            className="w-full sm:w-72 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-transparent"
            placeholder="Search mindmaps..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            onClick={openNew}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold transition-colors"
            title="Add Mind Map"
          >
            +
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        <div className={`mb-2 flex items-center ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {loading ? 'Loading…' : `${mindmaps.length} mindmaps`}
          </div>
        </div>

        <div className="h-[520px] overflow-y-auto space-y-3 pr-1">
          {mindmaps.map((m) => (
            <div key={m.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0a0f16]">
              <div className={`flex items-start gap-3 ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500">
                    {m.updatedAt ? new Date(m.updatedAt).toLocaleString() : m.createdAt ? new Date(m.createdAt).toLocaleString() : ''}
                  </div>
                  <div className="mt-2 text-base font-medium text-zinc-900 dark:text-zinc-100">
                    {m.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {m.nodes?.length || 0} nodes, {m.edges?.length || 0} connections
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button 
                    className="rounded border px-3 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" 
                    onClick={() => openEdit(m)}
                  >
                    Edit
                  </button>
                  <button 
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors" 
                    onClick={() => handleDelete(m.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {mindmaps.length === 0 && !loading ? (
            <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-slate-700">
              No mindmaps yet. Click + to create your first mindmap.
            </div>
          ) : null}
        </div>
      </div>

      {openMindmap && (
        <WidgetMindmap
          onClose={() => {
            setOpenMindmap(false)
            setSelectedMindmap(null)
          }}
          goals={goals}
          mindmap={selectedMindmap}
          onSave={handleSave}
        />
      )}
    </section>
  )
}
