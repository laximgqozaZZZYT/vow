"use client"

import React from 'react'
import mermaid from 'mermaid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import api, { DiaryCard, DiaryTag } from '@/lib/api'
import DiaryTagManagerModal from './Modal.TagManager'
import DiaryModal from './Modal.Diary'

type Goal = { id: string; name: string }
type Habit = { id: string; name: string }

// Complete Mermaid isolation system
const mermaidInstances = new Map<string, any>()

function createIsolatedMermaidRenderer(instanceId: string) {
  // Create a completely isolated mermaid instance
  const renderer = {
    id: instanceId,
    render: async (code: string, container: HTMLElement) => {
      try {
        // Clear container
        container.innerHTML = ''
        
        // Create shadow DOM for complete isolation
        const shadowHost = document.createElement('div')
        shadowHost.style.cssText = `
          width: 100%;
          height: auto;
          min-height: 100px;
          position: relative;
          isolation: isolate;
          contain: layout style paint;
        `
        
        const mermaidDiv = document.createElement('div')
        mermaidDiv.className = 'mermaid'
        mermaidDiv.id = `${instanceId}-render`
        mermaidDiv.textContent = code.trim()
        mermaidDiv.style.cssText = `
          width: 100%;
          height: auto;
          visibility: hidden;
        `
        
        shadowHost.appendChild(mermaidDiv)
        container.appendChild(shadowHost)
        
        // Initialize mermaid if needed
        const mm: any = mermaid as any
        if (!mm) throw new Error('Mermaid not available')
        
        // Configure mermaid for this instance
        if (mm.initialize) {
          mm.initialize({
            startOnLoad: false,
            theme: 'dark',
            securityLevel: 'loose',
            deterministicIds: false,
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true
            }
          })
        }
        
        // Render with multiple fallback methods
        let rendered = false
        
        // Method 1: Modern run API
        if (!rendered && mm.run) {
          try {
            await mm.run({ nodes: [mermaidDiv] })
            rendered = true
          } catch (e) {
            console.warn('Mermaid run method failed:', e)
          }
        }
        
        // Method 2: renderAsync API
        if (!rendered && mm.renderAsync) {
          try {
            const result = await mm.renderAsync(`${instanceId}-svg-${Date.now()}`, code)
            if (result?.svg) {
              mermaidDiv.innerHTML = result.svg
              rendered = true
            }
          } catch (e) {
            console.warn('Mermaid renderAsync method failed:', e)
          }
        }
        
        // Method 3: Legacy render API
        if (!rendered && mm.render) {
          try {
            await new Promise<void>((resolve, reject) => {
              const renderTimeout = setTimeout(() => reject(new Error('Render timeout')), 5000)
              
              mm.render(`${instanceId}-legacy-${Date.now()}`, code, (svgCode: string) => {
                clearTimeout(renderTimeout)
                try {
                  mermaidDiv.innerHTML = svgCode
                  resolve()
                } catch (e) {
                  reject(e)
                }
              })
            })
            rendered = true
          } catch (e) {
            console.warn('Mermaid render method failed:', e)
          }
        }
        
        // Method 4: Legacy init API
        if (!rendered && mm.init) {
          try {
            mm.init(undefined, mermaidDiv)
            rendered = true
          } catch (e) {
            console.warn('Mermaid init method failed:', e)
          }
        }
        
        if (!rendered) {
          throw new Error('All mermaid rendering methods failed')
        }
        
        // Show the rendered content
        mermaidDiv.style.visibility = 'visible'
        
        return true
      } catch (error) {
        throw error
      }
    }
  }
  
  mermaidInstances.set(instanceId, renderer)
  return renderer
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [isRendering, setIsRendering] = React.useState(false)
  const instanceId = React.useMemo(() => 
    `mermaid-isolated-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`, 
    []
  )

  React.useEffect(() => {
    let cancelled = false
    let renderTimeout: NodeJS.Timeout

    const performRender = async () => {
      const container = containerRef.current
      if (!container || isRendering || cancelled) return

      setIsRendering(true)
      setErr(null)
      
      renderTimeout = setTimeout(async () => {
        if (cancelled) return
        
        try {
          const renderer = createIsolatedMermaidRenderer(instanceId)
          await renderer.render(code, container)
          
          if (!cancelled) {
            setErr(null)
          }
        } catch (error: any) {
          if (!cancelled) {
            console.error(`Mermaid render error for ${instanceId}:`, error)
            setErr(`Failed to render diagram: ${error?.message || error || 'Unknown error'}`)
          }
        } finally {
          if (!cancelled) {
            setIsRendering(false)
          }
        }
      }, 200) // Increased delay for better stability
    }

    performRender()
    
    return () => {
      cancelled = true
      if (renderTimeout) clearTimeout(renderTimeout)
      setIsRendering(false)
      // Clean up instance
      mermaidInstances.delete(instanceId)
    }
  }, [code, instanceId])

  return (
    <div className="my-3">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/10 dark:bg-black/20 relative">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 dark:border-white/10 dark:bg-white/5">mermaid</span>
          <span className="truncate">diagram</span>
          {isRendering && <span className="text-blue-400">rendering...</span>}
        </div>
        <div
          ref={containerRef}
          className="overflow-x-auto relative min-h-[100px] [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:min-w-[320px] [&_svg]:text-zinc-800 dark:[&_svg]:text-zinc-100"
          style={{ 
            isolation: 'isolate',
            zIndex: 1,
            contain: 'layout style paint'
          }}
        />
      </div>
      {err ? (
        <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          {err}
          <div className="mt-2 text-[11px] text-red-200/70">Fallback source:</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-red-100/80">{code}</pre>
        </div>
      ) : null}
    </div>
  )
}

function Markdown({ value }: { value: string }) {
  // Simplified markdown rendering for card display
  const sanitizeSchema: any = React.useMemo(() => {
    const schema: any = structuredClone ? structuredClone(defaultSchema as any) : JSON.parse(JSON.stringify(defaultSchema))
    schema.tagNames = Array.from(new Set([...(schema.tagNames || []), 'input', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark']))
    schema.attributes = schema.attributes || {}
    schema.attributes.code = [...(schema.attributes.code || []), ['className']]
    schema.attributes.span = [...(schema.attributes.span || []), ['className']]
    schema.attributes.a = [...(schema.attributes.a || []), ['target'], ['rel']]
    schema.attributes.img = [...(schema.attributes.img || []), ['src'], ['alt'], ['title'], ['width'], ['height']]
    schema.attributes.input = [...(schema.attributes.input || []), ['type'], ['checked'], ['disabled']]
    schema.attributes.th = [...(schema.attributes.th || []), ['align']]
    schema.attributes.td = [...(schema.attributes.td || []), ['align']]
    return schema
  }, [])

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeRaw, { passThrough: ['code'] }], [rehypeSanitize, sanitizeSchema]]}
        components={{
          code(props: any) {
            const { className, children } = props
            const match = /language-(\w+)/.exec(className || '')
            const lang = match?.[1]
            const raw = String(children ?? '')
            if (lang === 'mermaid') {
              return <MermaidBlock code={raw} />
            }
            // Inline code: react-markdown uses <code> inside <pre> for fenced blocks;
            // our <pre> styling handles those.
            const isInline = !(props as any)?.node?.position?.start || (props as any)?.inline
            if (isInline) {
              return (
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.92em] font-medium dark:bg-white/10 dark:text-zinc-100">
                  {children}
                </code>
              )
            }
            return <code {...props} />
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

function arraysEqualAsSets(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const as = new Set(a)
  for (const x of b) if (!as.has(x)) return false
  return true
}

export default function DiarySection({ goals, habits }: { goals: Goal[]; habits: Habit[] }) {
  const [cards, setCards] = React.useState<DiaryCard[]>([])
  const [tags, setTags] = React.useState<DiaryTag[]>([])

  // filters
  const [query, setQuery] = React.useState('')
  // tag/goal/habit filters were removed from the UI for simplicity.

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [tagManagerOpen, setTagManagerOpen] = React.useState(false)

  // editor
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<null | {
    id?: string
    frontMd: string
    backMd: string
    tagIds: string[]
    goalIds: string[]
    habitIds: string[]
  }>(null)

  const refreshTags = React.useCallback(async () => {
    const t = await api.getDiaryTags()
    setTags(t)
  }, [])

  const refreshCards = React.useCallback(async () => {
    setLoading(true)
    try {
      const c = await api.getDiaryCards({ query })
      setCards(c)
      setError(null)
    } catch (e: any) {
      setError(String(e?.body ?? e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }, [query])

  React.useEffect(() => {
    refreshTags().catch((e: any) => setError(String(e?.body ?? e?.message ?? e)))
  }, [refreshTags])

  React.useEffect(() => {
    refreshCards()
  }, [refreshCards])

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const openNew = () => {
    setEditing({ frontMd: '', backMd: '', tagIds: [], goalIds: [], habitIds: [] })
    setEditorOpen(true)
  }

  const openEdit = (c: DiaryCard) => {
    const tagIds = (c.tags ?? []).map(t => t.id)
    const goalIds = (c.goals ?? []).map((g: any) => String(g.goalId))
    const habitIds = (c.habits ?? []).map((h: any) => String(h.habitId))
    setEditing({ id: c.id, frontMd: c.frontMd ?? '', backMd: c.backMd ?? '', tagIds, goalIds, habitIds })
    setEditorOpen(true)
  }

  const saveCard = async (payload: { id?: string; frontMd: string; backMd: string; tagIds: string[]; goalIds: string[]; habitIds: string[] }) => {
    if (payload.id) {
      await api.updateDiaryCard(payload.id, {
        frontMd: payload.frontMd,
        backMd: payload.backMd,
        tagIds: payload.tagIds,
        goalIds: payload.goalIds,
        habitIds: payload.habitIds,
      })
    } else {
      await api.createDiaryCard({
        frontMd: payload.frontMd,
        backMd: payload.backMd,
        tagIds: payload.tagIds,
        goalIds: payload.goalIds,
        habitIds: payload.habitIds,
      })
    }
    await refreshCards()
  }

  const deleteCard = async (id: string) => {
    await api.deleteDiaryCard(id)
    await refreshCards()
  }

  const createTag = async (p: { name: string; color?: string | null }) => {
    await api.createDiaryTag(p)
    await refreshTags()
  }

  const updateTag = async (id: string, p: { name?: string; color?: string | null }) => {
    await api.updateDiaryTag(id, p)
    await refreshTags()
  }

  const deleteTag = async (id: string) => {
    await api.deleteDiaryTag(id)
    if (editing?.tagIds?.includes(id)) {
      setEditing(e => (e ? { ...e, tagIds: e.tagIds.filter(x => x !== id) } : e))
    }
    await refreshTags()
    await refreshCards()
  }

  const clearFilters = () => {
    setQuery('')
  }

  return (
    <section className="rounded bg-white p-4 shadow dark:bg-[#0b0b0b]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">Diary</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <input
            className="w-full sm:w-72 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-transparent"
            placeholder="Search text..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="rounded border px-3 py-1.5 text-sm" onClick={refreshCards} disabled={loading}>
            Search
          </button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={() => setTagManagerOpen(true)}>
            Manage Tags
          </button>
          <button className="rounded border px-3 py-1.5 text-sm" onClick={clearFilters}>
            Clear filters
          </button>
          <button className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white" onClick={openNew}>
            + New
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {loading ? 'Loading…' : `${cards.length} cards`}
          </div>
          <button className="rounded border px-3 py-1 text-sm" onClick={refreshCards} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="h-[520px] overflow-y-auto space-y-3 pr-1">
          {cards.map((c, index) => (
            <div 
              key={c.id} 
              className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0a0f16] relative"
              style={{ 
                isolation: 'isolate',
                zIndex: cards.length - index,
                contain: 'layout style paint'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                  </div>
                  <div className="mt-2 relative" style={{ isolation: 'isolate' }}>
                    <Markdown value={c.frontMd ?? ''} />
                  </div>
                </div>
                <button className="rounded border px-3 py-1 text-sm flex-shrink-0" onClick={() => openEdit(c)}>
                  Edit
                </button>
              </div>

              <div className="mt-3 text-xs text-zinc-500 flex flex-wrap gap-2">
                {(c.tags ?? []).map(t => (
                  <span key={t.id} className="rounded-full border px-2 py-0.5 dark:border-slate-700" style={t.color ? { borderColor: t.color } : undefined}>
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {cards.length === 0 && !loading ? (
            <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-slate-700">
              No diary cards yet.
            </div>
          ) : null}
        </div>
      </div>

      <DiaryModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        goals={goals}
        habits={habits}
        tags={tags}
        initial={editing}
        onSave={saveCard}
        onDelete={editing?.id ? deleteCard : undefined}
      />

      <DiaryTagManagerModal
        open={tagManagerOpen}
        onClose={() => setTagManagerOpen(false)}
        tags={tags}
        goals={goals}
        habits={habits}
        onCreate={createTag}
        onUpdate={updateTag}
        onDelete={deleteTag}
      />
    </section>
  )
}
