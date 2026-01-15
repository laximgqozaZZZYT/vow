"use client"

import React from 'react'
import mermaid from 'mermaid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import api, { DiaryCard } from '@/lib/api'
import DiaryTagManagerModal from './Modal.TagManager'
import DiaryModal from './Modal.Diary'
import { useHandedness } from '../contexts/HandednessContext'
import type { Tag } from '../types'

type Goal = { id: string; name: string }
type Habit = { id: string; name: string }

function MermaidBlock({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [isRendering, setIsRendering] = React.useState(false)
  const instanceId = React.useMemo(() => 
    `mermaid-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`, 
    []
  )

  React.useEffect(() => {
    let cancelled = false
    let renderTimeout: NodeJS.Timeout

    const performRender = async () => {
      const container = containerRef.current
      if (!container || isRendering || cancelled) return

      // Only render on client side
      if (typeof window === 'undefined') return

      setIsRendering(true)
      setErr(null)
      
      renderTimeout = setTimeout(async () => {
        if (cancelled) return
        
        try {
          // Clear container
          container.innerHTML = ''
          
          const mermaidDiv = document.createElement('div')
          mermaidDiv.className = 'mermaid'
          mermaidDiv.id = `${instanceId}-render`
          mermaidDiv.textContent = code.trim()
          container.appendChild(mermaidDiv)
          
          // Initialize mermaid with safety checks
          const mm: any = mermaid as any
          if (!mm) throw new Error('Mermaid not available')
          
          // Check if we're in a proper browser environment
          if (typeof document === 'undefined' || !document.createElementNS) {
            throw new Error('Browser environment not available')
          }
          
          // Configure mermaid
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
          
          // Try modern run API first
          if (mm.run) {
            try {
              await mm.run({ nodes: [mermaidDiv] })
            } catch (e) {
              console.warn('Mermaid run method failed, trying legacy render:', e)
              // Fallback to legacy render
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
            }
          } else if (mm.render) {
            // Legacy render method
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
          } else {
            throw new Error('No mermaid render method available')
          }
          
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
      }, 300)
    }

    performRender()
    
    return () => {
      cancelled = true
      if (renderTimeout) clearTimeout(renderTimeout)
      setIsRendering(false)
    }
  }, [code, instanceId])

  return (
    <div className="my-3">
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 shadow-inner dark:border-white/10 dark:bg-black/20">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 dark:border-white/10 dark:bg-white/5">mermaid</span>
          <span className="truncate">diagram</span>
          {isRendering && <span className="text-blue-400">rendering...</span>}
        </div>
        <div
          ref={containerRef}
          className="overflow-x-auto [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:w-full [&_svg]:text-zinc-800 dark:[&_svg]:text-zinc-100"
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
  // Normalize markdown input (same as Modal.Diary.tsx)
  const normalized = React.useMemo(() => {
    const v = value ?? ''
    // Fix ATX headings without space (e.g. "#Title" -> "# Title")
    const withHeadingSpace = v.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

    // Obsidian-ish extras:
    // - ==highlight== -> <mark>highlight</mark>
    // - [[Page]] or [[Page|Alias]] -> link-like markdown
    // - #tag -> link-like markdown (non-destructive; avoids inside URLs)
    const withHighlight = withHeadingSpace.replace(/==([^\n=][^\n]*?)==/g, '<mark>$1</mark>')

    const withWikiLinks = withHighlight.replace(/\[\[([^\]|\n]+?)(?:\|([^\]\n]+?))?\]\]/g, (_m, page, alias) => {
      const text = (alias || page).trim()
      const target = String(page).trim().replace(/\s+/g, '-')
      // For now we link to a hash route so it works without new pages.
      return `[${text}](#note:${encodeURIComponent(target)})`
    })

    const withHashTags = withWikiLinks.replace(/(^|\s)#([\p{L}0-9_\-\/]+)\b/gu, (_m, pre, tag) => {
      return `${pre}[#${tag}](#tag:${encodeURIComponent(tag)})`
    })

    return withHashTags
  }, [value])

  // Enhanced sanitize schema for better markdown support
  const sanitizeSchema = React.useMemo(() => {
    const schema = structuredClone ? structuredClone(defaultSchema) : JSON.parse(JSON.stringify(defaultSchema))
    
    // Add necessary HTML tags for markdown features
    schema.tagNames = Array.from(new Set([
      ...(schema.tagNames || []), 
      'input', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 
      'blockquote', 'pre', 'code', 'del', 'ins'
    ]))
    
    // Enhanced attributes
    schema.attributes = schema.attributes || {}
    schema.attributes.code = [...(schema.attributes.code || []), ['className']]
    schema.attributes.pre = [...(schema.attributes.pre || []), ['className']]
    schema.attributes.input = [...(schema.attributes.input || []), ['type'], ['checked'], ['disabled']]
    schema.attributes.th = [...(schema.attributes.th || []), ['align'], ['scope']]
    schema.attributes.td = [...(schema.attributes.td || []), ['align']]
    schema.attributes.table = [...(schema.attributes.table || []), ['className']]
    schema.attributes.blockquote = [...(schema.attributes.blockquote || []), ['className']]
    schema.attributes.mark = [...(schema.attributes.mark || []), ['className']]
    schema.attributes.span = [...(schema.attributes.span || []), ['className']]
    schema.attributes.a = [...(schema.attributes.a || []), ['target'], ['rel']]
    schema.attributes.img = [...(schema.attributes.img || []), ['src'], ['alt'], ['title'], ['width'], ['height']]
    
    return schema
  }, [])

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-zinc">
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
            
            const isInline = !(props as any)?.node?.position?.start
            if (isInline) {
              return (
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[0.9em] font-mono font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {children}
                </code>
              )
            }
            
            return (
              <code className="block rounded bg-zinc-50 p-3 text-sm font-mono overflow-x-auto dark:bg-zinc-900 dark:text-zinc-100">
                {children}
              </code>
            )
          },
          
          pre(props: any) {
            return (
              <pre className="rounded-lg bg-zinc-50 p-4 overflow-x-auto border dark:bg-zinc-900 dark:border-zinc-700">
                {props.children}
              </pre>
            )
          },
          
          blockquote(props: any) {
            return (
              <blockquote className="border-l-4 border-zinc-300 pl-4 py-2 my-4 italic text-zinc-600 bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:bg-zinc-900/50">
                {props.children}
              </blockquote>
            )
          },
          
          table(props: any) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-600">
                  {props.children}
                </table>
              </div>
            )
          },
          
          th(props: any) {
            return (
              <th className="border border-zinc-300 px-3 py-2 bg-zinc-100 font-semibold text-left dark:border-zinc-600 dark:bg-zinc-800">
                {props.children}
              </th>
            )
          },
          
          td(props: any) {
            return (
              <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-600">
                {props.children}
              </td>
            )
          },
          h1(props: any) {
            return <h1 {...props} className={`mt-0 mb-3 text-3xl font-semibold tracking-tight border-b border-zinc-200 dark:border-white/10 pb-2 ${props?.className ?? ''}`} />
          },
          h2(props: any) {
            return <h2 {...props} className={`mt-8 mb-2 text-2xl font-semibold tracking-tight border-b border-zinc-200/80 dark:border-white/10 pb-1 pl-2 rounded bg-[linear-gradient(90deg,rgba(139,92,246,0.18),transparent)] ${props?.className ?? ''}`} />
          },
          h3(props: any) {
            return <h3 {...props} className={`mt-6 mb-2 text-xl font-semibold tracking-tight ${props?.className ?? ''}`} />
          },
          h4(props: any) {
            return <h4 {...props} className={`mt-5 mb-2 text-lg font-semibold ${props?.className ?? ''}`} />
          },
          h5(props: any) {
            return <h5 {...props} className={`mt-4 mb-2 text-base font-semibold ${props?.className ?? ''}`} />
          },
          h6(props: any) {
            return <h6 {...props} className={`mt-4 mb-2 text-sm font-semibold text-zinc-400 ${props?.className ?? ''}`} />
          },
          
          ul(props: any) {
            return <ul {...props} className={`my-3 list-disc pl-6 marker:text-violet-500 dark:marker:text-violet-300 ${props?.className ?? ''}`} />
          },
          ol(props: any) {
            return <ol {...props} className={`my-3 list-decimal pl-6 marker:text-violet-500 dark:marker:text-violet-300 ${props?.className ?? ''}`} />
          },
          li(props: any) {
            // If this is a task list item, react-markdown (remark-gfm) will include an <input type="checkbox" />
            // as the first child. We make list items flex so the checkbox aligns with the first line.
            const isTaskItem = Array.isArray(props?.children) && props.children.some((c: any) => c?.type === 'input' && c?.props?.type === 'checkbox')
            return (
              <li
                {...props}
                className={`${isTaskItem ? 'flex items-start gap-2' : ''} my-1 leading-6 pl-1 ${props?.className ?? ''}`}
              />
            )
          },
          
          a(props: any) {
            const href = props?.href as string | undefined
            // external links: open in new tab
            const isExternal = !!href && /^https?:\/\//i.test(href)
            return (
              <a
                {...props}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer noopener' : undefined}
                className={`text-violet-600 dark:text-violet-300 font-medium no-underline hover:underline ${props?.className ?? ''}`}
              />
            )
          },
          
          img(props: any) {
            const alt = props?.alt ?? ''
            return (
              <img
                {...props}
                alt={alt}
                loading="lazy"
                className={`max-w-full rounded-md border border-zinc-200/70 dark:border-white/10 ${props?.className ?? ''}`}
              />
            )
          },
          
          input(props: any) {
            // GFM task list checkboxes render as <input type="checkbox" checked />.
            if (props?.type !== 'checkbox') return <input {...props} />
            return (
              <input
                {...props}
                type="checkbox"
                checked={!!props?.checked}
                readOnly
                className={`mt-[2px] h-4 w-4 shrink-0 accent-violet-400 ${props?.className ?? ''}`}
              />
            )
          },
        }}
      >
        {normalized}
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

export default function DiarySection({ 
  goals, 
  habits,
  onManageTags 
}: { 
  goals: Goal[]; 
  habits: Habit[];
  onManageTags?: () => void;
}) {
  const { isLeftHanded } = useHandedness();
  const [cards, setCards] = React.useState<DiaryCard[]>([])
  const [tags, setTags] = React.useState<Tag[]>([])

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
    try {
      console.log('[Section.Diary] Starting to fetch tags...')
      const t = await api.getTags()
      console.log('[Section.Diary] Successfully fetched', t?.length || 0, 'tags')
      setTags(t)
    } catch (e: any) {
      console.error('[Section.Diary] Error fetching tags:', e)
      throw e
    }
  }, [])

  const refreshCards = React.useCallback(async () => {
    setLoading(true)
    try {
      console.log('[Section.Diary] Starting to fetch diary cards...')
      const c = await api.getDiaryCards()
      console.log('[Section.Diary] Successfully fetched', c?.length || 0, 'cards')
      setCards(c)
      setError(null)
    } catch (e: any) {
      console.error('[Section.Diary] Error fetching diary cards:', e)
      const errorMessage = String(e?.body ?? e?.message ?? e)
      console.error('[Section.Diary] Error message:', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refreshTags().catch((e: any) => {
      console.error('[Section.Diary] Error refreshing tags:', e)
      setError(String(e?.body ?? e?.message ?? e))
    })
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
    await api.createTag(p)
    await refreshTags()
  }

  const updateTag = async (id: string, p: { name?: string; color?: string | null }) => {
    await api.updateTag(id, p)
    await refreshTags()
  }

  const deleteTag = async (id: string) => {
    await api.deleteTag(id)
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
        <div className={`flex flex-wrap items-center gap-2 ${isLeftHanded ? 'justify-start' : 'justify-end'}`}>
          <input
            className="w-full sm:w-72 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-transparent"
            placeholder="Search text..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="rounded border px-3 py-1.5 text-sm" onClick={refreshCards} disabled={loading}>
            Search
          </button>
          <button 
            className="rounded border px-3 py-1.5 text-sm" 
            onClick={() => {
              if (onManageTags) {
                onManageTags();
              } else {
                setTagManagerOpen(true);
              }
            }}
          >
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
        <div className={`mb-2 flex items-center ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {loading ? 'Loading…' : `${cards.length} cards`}
          </div>
          <button className="rounded border px-3 py-1 text-sm" onClick={refreshCards} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="h-[520px] overflow-y-auto space-y-3 pr-1">
          {cards.map((c) => (
            <div key={c.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#0a0f16]">
              <div className={`flex items-start gap-3 ${isLeftHanded ? 'flex-row-reverse' : 'justify-between'}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-zinc-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                  </div>
                  <div className="mt-2">
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

