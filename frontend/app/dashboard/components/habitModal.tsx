"use client"

import React from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

// Helper: format a Date to local YYYY-MM-DD (avoid toISOString which uses UTC)
function formatLocalDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Helper: parse a YYYY-MM-DD string into a local Date (midnight local)
function parseYMD(s?: string | Date | null) {
    if (!s) return undefined
    if (s instanceof Date) return s
    const parts = (s || '').split('-').map(x => Number(x))
    if (parts.length >= 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2])
    }
    // fallback to Date constructor
    const d = new Date(s as string)
    return isNaN(d.getTime()) ? undefined : d
}

// build a list of time options (15-minute increments) with localized labels
function buildTimeOptions() {
    const opts: { label: string; value: string }[] = []
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const d = new Date()
            d.setHours(h, m, 0, 0)
            const label = d.toLocaleTimeString('ja-JP', { hour: 'numeric', minute: '2-digit' })
            const value = d.toTimeString().slice(0, 5)
            opts.push({ label, value })
        }
    }
    return opts
}

type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly'
type Timing = {
    id?: string
    type: TimingType
    date?: string
    start?: string
    end?: string
    cron?: string
}

type Habit = { id: string; goalId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; policy?: "Schedule" | "Count"; targetCount?: number; createdAt: string; updatedAt: string }

type CreateHabitPayload = { name: string; goalId: string; type: "do" | "avoid"; duration?: number; reminders?: any[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; timings?: any[]; allDay?: boolean; notes?: string; policy?: "Schedule" | "Count"; targetCount?: number }

export function HabitModal({ open, onClose, habit, onUpdate, onDelete, onCreate, initial, categories: goals }: { open: boolean; onClose: () => void; habit: Habit | null; onUpdate?: (h: Habit) => void; onDelete?: (id: string) => void; onCreate?: (payload: CreateHabitPayload) => void; initial?: { date?: string; time?: string; type?: "do" | "avoid"; goalId?: string }; categories?: { id: string; name: string }[] }) {
    const [name, setName] = React.useState<string>(habit?.name ?? "")
    const [notes, setNotes] = React.useState<string>(habit?.notes ?? "")
    const [dueDate, setDueDate] = React.useState<Date | undefined>(habit?.dueDate ? new Date(habit.dueDate) : undefined)
    const [time, setTime] = React.useState<string | undefined>(habit?.time ?? undefined)
    const [endTime, setEndTime] = React.useState<string | undefined>(undefined)
    const [allDay, setAllDay] = React.useState<boolean>(!!habit?.allDay)
    const [active, setActive] = React.useState<boolean>(!!habit?.active)
    const [type, setType] = React.useState<"do" | "avoid">(habit?.type ?? "do")
    const [policy, setPolicy] = React.useState<"Schedule" | "Count">("Schedule")
    const [targetCount, setTargetCount] = React.useState<number | undefined>(undefined)
    const [goalId, setGoalId] = React.useState<string | undefined>(habit?.goalId)
    // clone incoming arrays to avoid accidentally sharing references between timings/outdates
    const [timings, setTimings] = React.useState<Timing[]>((((habit as any)?.timings ?? []) as Timing[]).map(x => ({ ...x })))
    const [outdates, setOutdates] = React.useState<Timing[]>((((habit as any)?.outdates ?? []) as Timing[]).map(x => ({ ...x })))
    const [showOutdates, setShowOutdates] = React.useState<boolean>(false)
    const [startPickerTab, setStartPickerTab] = React.useState<'time' | 'datetime'>('time')
    const [endPickerTab, setEndPickerTab] = React.useState<'time' | 'datetime'>('time')

    const [timingType, setTimingType] = React.useState<TimingType>(habit?.dueDate ? 'Date' : 'Daily')
    const [timingWeekdays, setTimingWeekdays] = React.useState<number[]>((habit as any)?.timings?.find((t: Timing) => t.type === 'Weekly') ? ((habit as any).timings.find((t: Timing) => t.type === 'Weekly').cron ?? '').split(',').map((s: string) => Number(s)).filter((n: number) => !Number.isNaN(n)) : [])
    function toggleTimingWeekday(idx: number) { setTimingWeekdays(p => p.includes(idx) ? p.filter(i => i !== idx) : [...p, idx]) }

    // stable id for this modal instance (used when creating a new habit where `habit` may be null)
    const instanceId = React.useId()

    React.useEffect(() => {
        if (!open) return
        if (habit) {
            setPolicy(habit?.policy ?? 'Schedule')
            setTargetCount(habit?.targetCount ?? habit?.must ?? undefined)
            setName(habit?.name ?? '')
            setNotes(habit?.notes ?? '')
            setDueDate(habit?.dueDate ? new Date(habit.dueDate) : undefined)
            setTime(habit?.time ?? undefined)
            setEndTime(habit?.endTime ?? undefined)
            setAllDay(!!habit?.allDay)
            setActive(!!habit?.active)
            setType(habit?.type ?? 'do')
            setGoalId(habit?.goalId)
            // clone arrays when copying from habit to ensure independent state
            setTimings(((habit as any)?.timings ?? []).map((x: any) => ({ ...x })))
            setOutdates(((habit as any)?.outdates ?? []).map((x: any) => ({ ...x })))
            if (!((habit as any)?.timings ?? []).length) {
                const tType: TimingType = habit?.dueDate ? 'Date' : 'Daily'
                setTimings([{ type: tType, date: habit?.dueDate ? (typeof habit.dueDate === 'string' ? habit.dueDate : formatLocalDate(new Date(habit.dueDate))) : undefined, start: habit?.time ?? undefined, end: habit?.endTime ?? undefined }])
            }
            if (habit?.repeat && habit.repeat !== 'Does not repeat') {
                if (habit.repeat === 'Daily' || habit.repeat === 'Weekly' || habit.repeat === 'Monthly') {
                    setTimingType(habit.repeat as TimingType)
                }
            }
        } else {
            // creation defaults (use optional initial values)
            setPolicy('Schedule')
            setTargetCount(undefined)
            setName('')
            setNotes('')
            setDueDate(initial?.date ? new Date(initial.date) : undefined)
            setTime(initial?.time ?? undefined)
            setEndTime(undefined)
            setAllDay(false)
            setActive(true)
            setType(initial?.type ?? 'do')
            setGoalId(initial?.goalId)
            const tType: TimingType = initial?.date ? 'Date' : 'Daily'
            setTimings([{ type: tType, date: initial?.date ?? undefined, start: initial?.time ?? undefined, end: undefined }])
            setOutdates([])
            setTimingType(initial?.date ? 'Date' : 'Daily')
            setTimingWeekdays([])
        }
    }, [habit, initial, open])

    // only render the modal when open; hooks above run unconditionally to preserve order
    if (!open) return null

    function handleSave() {
        if (habit) {
            const updated: Habit = {
                ...habit!,
                id: habit!.id,
                goalId: goalId ?? habit!.goalId,
                name: name.trim() || "Untitled",
                notes: notes.trim() || undefined,
                time: time ?? undefined,
                allDay,
                active,
                type,
                dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
                policy,
                ...(targetCount ? { targetCount } as any : {}),
                ...(targetCount ? { must: targetCount } as any : {}),
                ...(timings && timings.length ? { timings } as any : {}),
                ...(outdates && outdates.length ? { outdates } as any : {}),
                endTime,
                updatedAt: new Date().toISOString(),
            }
            onUpdate && onUpdate(updated)
            onClose()
        } else {
            // creation flow
            const payload: CreateHabitPayload = {
                name: name.trim() || "Untitled",
                goalId: goalId ?? (goals && goals.length ? goals[0].id : ""),
                type,
                dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
                time: time ?? undefined,
                endTime,
                repeat: timingType,
                timings: timings && timings.length ? timings : undefined,
                allDay,
                policy,
                targetCount: targetCount ?? undefined,
                notes: notes.trim() || undefined,
            }
            onCreate && onCreate(payload)
            onClose()
        }
    }

    function handleDelete() {
        if (habit) onDelete && onDelete(habit.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/30">
            <div className="w-[720px] rounded bg-white px-4 pt-4 pb-0 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100 flex flex-col">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold">Habit</h2>
                    <button onClick={onClose} className="text-slate-500">✕</button>
                </div>

                {/* Scrollable content area with modern scrollbar */}
                <style>{`
                    .habit-scroll-area { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.6) transparent; }
                    .habit-scroll-area::-webkit-scrollbar { width: 10px; }
                    .habit-scroll-area::-webkit-scrollbar-track { background: transparent; }
                    .habit-scroll-area::-webkit-scrollbar-thumb { background: rgba(148,163,184,.6); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
                    .habit-scroll-area::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.85); }
                `}</style>

                <div className="mt-4 flex gap-4 habit-scroll-area overflow-auto max-h-[80vh] pr-2 modal-scroll-gap">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium mb-2">Name</h3>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add title" className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />

                        <div className="mt-6">
                            <h3 className="text-lg font-medium">Policy</h3>
                            <div className="mt-2 flex flex-col gap-2">
                                <div className="flex gap-3">
                                    <label className="inline-flex items-center gap-2">
                                        <input type="radio" name={`policy-${habit?.id ?? instanceId}`} value="Schedule" checked={policy === 'Schedule'} onChange={() => setPolicy('Schedule')} />
                                        <span className="text-sm">Schedule</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input type="radio" name={`policy-${habit?.id ?? instanceId}`} value="Count" checked={policy === 'Count'} onChange={() => setPolicy('Count')} />
                                        <span className="text-sm">Count</span>
                                    </label>
                                </div>
                            </div>

                            {policy === 'Schedule' && (
                                <div className="mt-4">
                                    <h3 className="text-lg font-medium">Timings</h3>
                                    <div className="mt-2 space-y-2">
                                        {timings.map((t, idx) => (
                                            <div key={idx} className="flex items-end gap-2 rounded px-2 py-2">
                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Timing</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.type === 'Date' ? 'A Day' : t.type}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-36`}>
                                                                <div className="rounded bg-white p-2 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Date' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Date' ? 'bg-sky-600 text-white' : ''}`}>A Day</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Daily' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Daily' ? 'bg-sky-600 text-white' : ''}`}>Daily</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Weekly' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Weekly' ? 'bg-sky-600 text-white' : ''}`}>Weekly</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Monthly' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Monthly' ? 'bg-sky-600 text-white' : ''}`}>Monthly</button>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Date</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.date ? (parseYMD(t.date) ? parseYMD(t.date)!.toDateString() : new Date(t.date).toDateString()) : 'Select date'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-[min(380px,90vw)]`}>
                                                                <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <DayPicker mode="single" selected={t.date ? parseYMD(t.date) : undefined} onSelect={(d) => setTimings(s => s.map((x, i) => i === idx ? { ...x, date: d ? formatLocalDate(d) : undefined } : x))} />
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>

                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Start</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.start ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, start: opt.value } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.start === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">End</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.end ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, end: opt.value } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.end === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="ml-auto flex items-center gap-2">
                                                    {idx === 0 ? (
                                                        <button type="button" onClick={() => setTimings(s => [...s, { type: s[0]?.type ?? 'Daily', start: s[0]?.start ?? undefined, end: s[0]?.end ?? undefined }])} className="rounded bg-slate-100 p-1" aria-label="Add row" title="Add row">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => setTimings(s => s.filter((_, i) => i !== idx))} className="p-1 text-red-600" aria-label="Remove row" title="Remove row">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Outdates (collapsible) - Habit modal placement: show directly under Timings */}
                            <div className="mt-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-medium">Outdates (exclude periods)</h3>
                                    <div className="flex items-center gap-2">
                                        {/* Add outdate similar to the timings add button so users can quickly append using current picker values */}
                                        <button type="button" onClick={() => {
                                            const tType: TimingType = timingType ?? (dueDate ? 'Date' : 'Daily')
                                            const t: Timing = { type: tType, start: time ?? undefined, end: endTime ?? undefined }
                                            if (tType === 'Date' && dueDate) t.date = formatLocalDate(dueDate)
                                            if (tType === 'Weekly' && timingWeekdays.length) t.cron = `WEEKDAYS:${timingWeekdays.join(',')}`
                                            setOutdates((s) => [...s, t])
                                        }} className="rounded bg-slate-100 p-1" aria-label="Add outdate" title="Add outdate">
                                        </button>
                                        <button type="button" onClick={() => setShowOutdates(s => !s)} className="text-xs text-slate-500">{showOutdates ? 'Collapse' : 'Expand'}</button>
                                    </div>
                                </div>
                                {showOutdates && (
                                    <div className="mt-2 space-y-2">
                                        {outdates.length === 0 && <div className="text-xs text-zinc-500">No outdates added.</div>}
                                        {outdates.map((t, idx) => (
                                            <div key={idx} className="flex items-end gap-2 rounded px-2 py-2">
                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Timing</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.type === 'Date' ? 'A Day' : t.type}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-36`}>
                                                                <div className="rounded bg-white p-2 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <button type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, type: 'Date' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Date' ? 'bg-sky-600 text-white' : ''}`}>A Day</button>
                                                                    <button type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, type: 'Daily' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Daily' ? 'bg-sky-600 text-white' : ''}`}>Daily</button>
                                                                    <button type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, type: 'Weekly' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Weekly' ? 'bg-sky-600 text-white' : ''}`}>Weekly</button>
                                                                    <button type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, type: 'Monthly' } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Monthly' ? 'bg-sky-600 text-white' : ''}`}>Monthly</button>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Date</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.date ? (parseYMD(t.date) ? parseYMD(t.date)!.toDateString() : new Date(t.date).toDateString()) : 'Select date'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-[min(380px,90vw)]`}>
                                                                <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <DayPicker mode="single" selected={t.date ? parseYMD(t.date) : undefined} onSelect={(d) => setOutdates(s => s.map((x, i) => i === idx ? { ...x, date: d ? formatLocalDate(d) : undefined } : x))} />
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>

                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">Start</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.start ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, start: opt.value } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.start === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-28">
                                                    <div className="text-xs text-slate-500 mb-1">End</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-2 text-sm">{t.end ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-50 mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setOutdates(s => s.map((x, i) => i === idx ? { ...x, end: opt.value } : x))} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.end === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="ml-auto flex items-center gap-2">
                                                    {idx === 0 ? (
                                                        <div className="flex items-center gap-2">
                                                            <button type="button" onClick={() => setOutdates(s => [...s, { type: s[0]?.type ?? 'Daily', start: s[0]?.start ?? undefined, end: s[0]?.end ?? undefined }])} className="rounded bg-slate-100 p-1" aria-label="Add outdate" title="Add outdate">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                                </svg>
                                                            </button>
                                                            {/* Also allow deleting the first outdate row */}
                                                            <button type="button" onClick={() => setOutdates(s => s.filter((_, i) => i !== idx))} className="p-1 text-red-600" aria-label="Remove outdate" title="Remove outdate">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button type="button" onClick={() => setOutdates(s => s.filter((_, i) => i !== idx))} className="p-1 text-red-600" aria-label="Remove outdate" title="Remove outdate">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {policy === 'Count' && (
                                <div className="mt-3">
                                    <h3 className="text-lg font-medium">Target count</h3>
                                    <input type="number" min={1} value={targetCount ?? ''} onChange={(e) => setTargetCount(Number(e.target.value) || undefined)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" />
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <h3 className="text-lg font-medium">Type</h3>
                            <div className="mt-2 flex flex-col gap-2">
                                <div className="flex gap-3">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="habit-type"
                                            value="do"
                                            checked={type === 'do'}
                                            onChange={() => setType('do')}
                                            className="form-radio"
                                        />
                                        <span className="text-sm">Good</span>
                                    </label>

                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="habit-type"
                                            value="avoid"
                                            checked={type === 'avoid'}
                                            onChange={() => setType('avoid')}
                                            className="form-radio"
                                        />
                                        <span className="text-sm">Bad</span>
                                    </label>
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">Good = show on calendar. Bad = track but hide from calendar.</div>
                                <div className="mt-4">
                                    <h3 className="text-lg font-medium mb-2">Goal</h3>
                                    <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                        {(goals ?? []).map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mt-4">
                                    <h3 className="text-lg font-medium">Description</h3>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full rounded border px-3 py-2 bg-white text-black dark:bg-slate-800 dark:text-slate-100" placeholder="Add description" />
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                <div className="flex gap-2 p-3">
                    <button onClick={handleSave} className="rounded bg-blue-600 px-4 py-2 text-white mr-2">Save</button>
                    <button onClick={onClose} className="px-4 py-2 dark:bg-slate-800 dark:text-slate-100 text-black">Cancel</button>
                    {habit && <button onClick={handleDelete} className="ml-auto text-sm text-red-600">Delete</button>}
                </div>
            </div>
        </div>
    )
}
