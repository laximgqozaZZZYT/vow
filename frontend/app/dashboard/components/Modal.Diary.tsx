"use client"

import React from 'react'
import mermaid from 'mermaid'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Tag } from '../types'

type Goal = { id: string; name: string }
type Habit = { id: string; name: string }

// Mermaid can throw "Diagram flowchart-v2 already registered" if initialized multiple times.
let mermaidInitialized = false
function initMermaidOnce() {
  if (mermaidInitialized) return
  try {
    if ((mermaid as any)?.initialize) {
      mermaid.initialize({ startOnLoad: false })
    }
  } catch {
    // ignore
  }
  mermaidInitialized = true
}

const markdownThemeClass = [
  // base typography (Obsidian-like)
  'prose prose-sm max-w-none dark:prose-invert',
  'prose-p:leading-6 prose-p:my-3',
  // headings (bigger, tight, with subtle bottom rule on h1/h2)
  'prose-headings:font-semibold prose-headings:tracking-tight',
  'prose-h1:text-3xl prose-h1:mt-0 prose-h1:mb-3 prose-h1:pb-2 prose-h1:border-b prose-h1:border-zinc-200 dark:prose-h1:border-white/10',
  'prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-zinc-200/80 dark:prose-h2:border-white/10',
  // H2 gets an accent bar (Obsidian-ish): emulate via background gradient
  'prose-h2:bg-[linear-gradient(90deg,rgba(139,92,246,0.18),transparent)] dark:prose-h2:bg-[linear-gradient(90deg,rgba(139,92,246,0.18),transparent)] prose-h2:pl-2 prose-h2:rounded',
  'prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2',
  // lists (Obsidian-style spacing)
  'prose-ul:my-3 prose-ol:my-3 prose-li:my-1',
  'prose-ul:pl-6 prose-ol:pl-6',
  // make bullets/numbers pop (otherwise they can look "flat" in dark mode)
  'prose-li:marker:text-violet-500 dark:prose-li:marker:text-violet-300',
  'prose-ol:list-decimal prose-ul:list-disc',
  // nested lists indentation (make nesting feel deliberate)
  'prose-li:pl-1',
  'prose-li:leading-6',
  'prose-ul:prose-li:my-1 prose-ol:prose-li:my-1',
  'prose-ul:prose-ul:my-2 prose-ol:prose-ol:my-2 prose-ul:prose-ol:my-2 prose-ol:prose-ul:my-2',
  'prose-ul:prose-ul:pl-6 prose-ol:prose-ol:pl-6 prose-ul:prose-ol:pl-6 prose-ol:prose-ul:pl-6',
  // emphasis + links (Obsidian accent)
  'prose-a:text-violet-600 dark:prose-a:text-violet-300 prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
  'prose-strong:text-zinc-900 dark:prose-strong:text-white',
  'prose-del:text-zinc-500 dark:prose-del:text-zinc-400',
  // highlight (Obsidian ==highlight==)
  'prose-mark:rounded prose-mark:bg-yellow-200/30 prose-mark:px-1 prose-mark:py-0.5 prose-mark:text-yellow-100',
  // inline code & code blocks
  'prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-medium',
  'dark:prose-code:bg-white/10 dark:prose-code:text-zinc-100',
  'prose-pre:bg-zinc-950 prose-pre:text-zinc-100 dark:prose-pre:bg-black/40',
  'prose-pre:border prose-pre:border-zinc-200/70 dark:prose-pre:border-white/10',
  // hr
  'prose-hr:my-6 prose-hr:border-zinc-200/70 dark:prose-hr:border-white/10',
  // blockquotes (Obsidian callout-ish)
  'prose-blockquote:rounded prose-blockquote:border-l-4',
  'prose-blockquote:border-violet-300 dark:prose-blockquote:border-violet-700',
  'prose-blockquote:bg-violet-50 prose-blockquote:py-1 prose-blockquote:px-4',
  'dark:prose-blockquote:bg-violet-500/10',
  'prose-blockquote:text-zinc-700 dark:prose-blockquote:text-zinc-100',
  // make headings stand out more against dark background
  'prose-headings:text-zinc-900 dark:prose-headings:text-zinc-50',
  // tables (GFM)
  // Make tables readable in both light/dark. Also avoid layout breakage by allowing horizontal scroll.
  'prose-table:my-4 prose-table:w-full prose-table:border-collapse',
  'prose-table:block prose-table:overflow-x-auto prose-table:whitespace-nowrap',
  // Force visible grid lines (white). This avoids "looks unchanged" in dark UI.
  'prose-thead:border-b prose-thead:border-white/50',
  'prose-tr:border-b prose-tr:border-white/15',
  'prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold',
  'prose-th:bg-zinc-50/80 dark:prose-th:bg-white/5',
  'prose-td:px-3 prose-td:py-2',
  'prose-th:border prose-td:border',
  'prose-th:border-white/50 prose-td:border-white/35',
  'prose-td:align-top',
].join(' ')

function MermaidBlock({ code }: { code: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    initMermaidOnce()
    let cancelled = false

    async function run() {
      try {
        const el = containerRef.current
        if (!el) return
        el.innerHTML = ''

        const m = document.createElement('div')
        m.className = 'mermaid'
        m.textContent = code
        el.appendChild(m)

        const mm: any = mermaid as any
        if (mm?.run) await mm.run({ nodes: [m] })
        else if (mm?.init) mm.init(undefined, m)

        if (!cancelled) setErr(null)
      } catch (e: any) {
        if (cancelled) return
        setErr(String(e?.message ?? e ?? 'Failed to render mermaid'))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <div className="my-3">
      <div className="rounded-md border border-white/10 bg-black/20 p-3 shadow-inner">
        <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5">mermaid</span>
          <span className="truncate">diagram</span>
        </div>
        <div
          ref={containerRef}
          className="overflow-x-auto [&_svg]:max-w-none [&_svg]:h-auto [&_svg]:min-w-[320px] [&_svg]:text-zinc-100"
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
  // Be forgiving with common user input: allow ATX headings without a space (e.g. "#Title").
  // This makes the preview feel closer to real-world editors.
  const normalized = React.useMemo(() => {
    const v = value ?? ''
    const withHeadingSpace = v.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

    // Obsidian-ish extras (minimal, safe):
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

  // Allow a safe subset of HTML (Obsidian supports inline HTML).
  // Also allow className so code fences can carry language-*.
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
    <div className={markdownThemeClass}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeRaw, { passThrough: ['code'] }], [rehypeSanitize, sanitizeSchema]]}
        components={{
          table(props: any) {
            return (
              <div className="my-3 overflow-x-auto rounded-md border border-white/15 bg-white/5">
                <table {...props} className={`w-full border-collapse text-sm ${props?.className ?? ''}`} />
              </div>
            )
          },
          th(props: any) {
            return (
              <th
                {...props}
                className={`border border-white/50 bg-white/5 px-3 py-2 text-left font-semibold ${props?.className ?? ''}`}
              />
            )
          },
          td(props: any) {
            return (
              <td
                {...props}
                className={`border border-white/35 px-3 py-2 align-top ${props?.className ?? ''}`}
              />
            )
          },
          h1(props: any) {
            return <h1 {...props} className={`mt-0 mb-3 text-3xl font-semibold tracking-tight border-b border-white/10 pb-2 ${props?.className ?? ''}`} />
          },
          h2(props: any) {
            return <h2 {...props} className={`mt-8 mb-2 text-2xl font-semibold tracking-tight border-b border-white/10 pb-1 pl-2 rounded bg-[linear-gradient(90deg,rgba(139,92,246,0.18),transparent)] ${props?.className ?? ''}`} />
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
            return <ul {...props} className={`my-3 list-disc pl-6 marker:text-zinc-400 ${props?.className ?? ''}`} />
          },
          ol(props: any) {
            return <ol {...props} className={`my-3 list-decimal pl-6 marker:text-zinc-400 ${props?.className ?? ''}`} />
          },
          li(props: any) {
            // If this is a task list item, react-markdown (remark-gfm) will include an <input type="checkbox" />
            // as the first child. We make list items flex so the checkbox aligns with the first line.
            const isTaskItem = Array.isArray(props?.children) && props.children.some((c: any) => c?.type === 'input' && c?.props?.type === 'checkbox')
            return (
              <li
                {...props}
                className={`${isTaskItem ? 'flex items-start gap-2' : ''} my-1 leading-6 ${props?.className ?? ''}`}
              />
            )
          },
          blockquote(props: any) {
            return (
              <blockquote
                {...props}
                className={`my-4 rounded-md border-l-4 border-violet-600/50 bg-white/5 px-4 py-2 text-zinc-200 ${props?.className ?? ''}`}
              />
            )
          },
          pre(props: any) {
            return (
              <pre
                {...props}
                className={`my-4 overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-[12px] leading-5 text-zinc-100 ${props?.className ?? ''}`}
              />
            )
          },
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
                <code
                  {...props}
                  className={`rounded bg-white/10 px-1 py-0.5 text-[0.92em] text-zinc-100 ${className ?? ''}`}
                >
                  {children}
                </code>
              )
            }
            return <code className={className}>{children}</code>
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

function TagPill({ label, color, selected, onClick }: { label: string; color?: string | null; selected?: boolean; onClick?: () => void }) {
  const style: React.CSSProperties = {}
  if (color) style.borderColor = color
  if (color && selected) style.backgroundColor = `${color}22`

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2 py-1 text-xs ${selected ? 'font-semibold' : ''} dark:border-slate-700`}
      style={style}
      title={label}
    >
      {label}
    </button>
  )
}

export default function DiaryModal({
  open,
  onClose,
  goals,
  habits,
  tags,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  goals: Goal[]
  habits: Habit[]
  tags: Tag[]
  initial: null | {
    id?: string
    frontMd: string
    backMd: string
    tagIds: string[]
    goalIds: string[]
    habitIds: string[]
  }
  onSave: (payload: { id?: string; frontMd: string; backMd: string; tagIds: string[]; goalIds: string[]; habitIds: string[] }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}) {
  const [tab, setTab] = React.useState<'front' | 'back'>('front')
  const [frontMd, setFrontMd] = React.useState('')
  const [backMd, setBackMd] = React.useState('')
  const [tagIds, setTagIds] = React.useState<string[]>([])
  const [goalIds, setGoalIds] = React.useState<string[]>([])
  const [habitIds, setHabitIds] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setTab('front') // default is front
    setFrontMd(initial?.frontMd ?? '')
    setBackMd(initial?.backMd ?? '')
    setTagIds(initial?.tagIds ?? [])
    setGoalIds(initial?.goalIds ?? [])
    setHabitIds(initial?.habitIds ?? [])
    setSaving(false)
    setError(null)
  }, [open, initial])

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const unifiedTagItems = React.useMemo(() => {
    type Item =
      | { kind: 'tag'; id: string; label: string; color?: string | null }
      | { kind: 'habit'; id: string; label: string }
      | { kind: 'goal'; id: string; label: string }

    const items: Item[] = []
    for (const t of tags) items.push({ kind: 'tag', id: t.id, label: t.name, color: t.color })
    // label format (requested):
    //   TagA
    //   Habit名サンプル(Habit)
    //   ゴール名サンプル(Goal)
    for (const h of habits) items.push({ kind: 'habit', id: h.id, label: `${h.name}(Habit)` })
    for (const g of goals) items.push({ kind: 'goal', id: g.id, label: `${g.name}(Goal)` })

    // keep stable sorting: free tags first, then habits, then goals; within each sort by label
    const rank: Record<Item['kind'], number> = { tag: 0, habit: 1, goal: 2 }
    return items.sort((a, b) => {
      const r = rank[a.kind] - rank[b.kind]
      if (r !== 0) return r
      return a.label.localeCompare(b.label, 'ja')
    })
  }, [tags, habits, goals])

  if (!open) return null

  const pasteSample = () => {
    const sample = [
      '# はじめに',
      'これは **Diary Card** のサンプルです。Obsidian/Notionでよく使う記法を一通り入れてあります。',
      '',
      '==ハイライト== / *斜体* / **強調** / ~~打ち消し~~',
      '',
      'Wikiリンク: [[Daily Note]] / [[Project X|別名表示]]',
      'タグ: #diary #my_tag #2026-01-02',
      '',
      '## セクション',
      '- 箇条書き 1',
      '- 箇条書き 2',
      '  - 入れ子（Nested） 1',
      '  - 入れ子（Nested） 2',
      '',
      '### タスク（チェックリスト / 入れ子）',
      '- [ ] 未完了タスク',
      '- [x] 完了タスク',
      '  - [ ] サブタスク A',
      '  - [x] サブタスク B',
      '- [ ] 3つめ',
      '',
      '---',
      '',
      '### 引用（Calloutっぽい）',
      '> これは引用です。メモ/注意書きに使えます。',
      '> \n',
      '> 2行目も出ます。',
      '',
      '### リンク',
      '- 自動リンク: https://example.com',
      '- Markdownリンク: [Example](https://example.com)',
      '',
      '### 画像',
      '![sample](https://placehold.co/900x260/png)',
      '',
      '### 表（GFM table）',
      '| Item | Value | Note |',
      '| --- | ---: | --- |',
      '| Sleep | 7.5 | ok |',
      '| Focus | 4 | needs improve |',
      '| Mood | 8 | 👍 |',
      '',
      '### コード',
      '```ts',
      'type Diary = { front: string; back: string }',
      'const x: Diary = { front: "hello", back: "world" }',
      '```',
      '',
      '```mermaid',
      'flowchart TD',
      '  A[Start] --> B{Decision}',
      '  B -->|Yes| C[OK]',
      '  B -->|No| D[Retry]',
      '```',
    ].join('\n')

    if (tab === 'front') setFrontMd(sample)
    else setBackMd(sample)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
      <div className="w-full max-w-5xl rounded bg-white px-4 pt-4 pb-4 shadow-lg text-black dark:bg-[#0f1724] dark:text-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-semibold">{initial?.id ? 'Edit Diary Card' : 'New Diary Card'}</h3>
          <button onClick={onClose} className="text-slate-500">✕</button>
        </div>

        {error ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className={`rounded border px-3 py-1 text-sm ${tab === 'front' ? 'bg-zinc-100 dark:bg-white/10' : ''}`} onClick={() => setTab('front')}>Front</button>
                <button className={`rounded border px-3 py-1 text-sm ${tab === 'back' ? 'bg-zinc-100 dark:bg-white/10' : ''}`} onClick={() => setTab('back')}>Back</button>
              </div>
              <div className="flex items-center gap-2">
                <button className="rounded border px-2 py-1 text-xs" onClick={pasteSample}>
                  Paste sample
                </button>
                <div className="text-xs text-zinc-500">Markdown (Mermaid supported)</div>
              </div>
            </div>

            {tab === 'front' ? (
              <textarea
                className="mt-2 h-72 w-full rounded border border-zinc-200 bg-white p-2 text-sm font-mono dark:border-slate-700 dark:bg-[#0b1220]"
                placeholder="Write front side..."
                value={frontMd}
                onChange={(e) => setFrontMd(e.target.value)}
              />
            ) : (
              <textarea
                className="mt-2 h-72 w-full rounded border border-zinc-200 bg-white p-2 text-sm font-mono dark:border-slate-700 dark:bg-[#0b1220]"
                placeholder="Write back side..."
                value={backMd}
                onChange={(e) => setBackMd(e.target.value)}
              />
            )}

            <div className="mt-3">
              <div className="text-xs text-zinc-500 mb-2">Tags</div>
              <div className="flex flex-wrap gap-2">
                {unifiedTagItems.map(item => {
                  const selected =
                    item.kind === 'tag'
                      ? tagIds.includes(item.id)
                      : item.kind === 'habit'
                        ? habitIds.includes(item.id)
                        : goalIds.includes(item.id)

                  const onClick =
                    item.kind === 'tag'
                      ? () => setTagIds(s => toggle(s, item.id))
                      : item.kind === 'habit'
                        ? () => setHabitIds(s => toggle(s, item.id))
                        : () => setGoalIds(s => toggle(s, item.id))

                  return (
                    <TagPill
                      key={`${item.kind}:${item.id}`}
                      label={item.label}
                      color={item.kind === 'tag' ? item.color : undefined}
                      selected={selected}
                      onClick={onClick}
                    />
                  )
                })}
                {unifiedTagItems.length === 0 ? <div className="text-xs text-zinc-500">No tags yet</div> : null}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {initial?.id && onDelete ? (
                  <button
                    className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        setSaving(true)
                        await onDelete(initial.id!)
                        onClose()
                      } catch (e: any) {
                        setError(String(e?.message ?? e))
                      } finally {
                        setSaving(false)
                      }
                    }}
                  >
                    Delete
                  </button>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded border px-3 py-2" onClick={onClose} disabled={saving}>Cancel</button>
                <button
                  className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                  disabled={saving}
                  onClick={async () => {
                    try {
                      setSaving(true)
                      setError(null)
                      await onSave({ id: initial?.id, frontMd, backMd, tagIds, goalIds, habitIds })
                      onClose()
                    } catch (e: any) {
                      setError(String(e?.message ?? e))
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Preview ({tab})</div>
              <div className="text-xs text-zinc-500">Rendered</div>
            </div>
            <div className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-zinc-200 bg-white p-3 shadow-inner dark:border-white/10 dark:bg-[#0a0f16]">
              <Markdown value={tab === 'front' ? frontMd : backMd} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}