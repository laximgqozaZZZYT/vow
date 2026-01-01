"use client"

import React, { useState } from "react"
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
    const d = new Date(s as string)
    return isNaN(d.getTime()) ? undefined : d
}

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

type Frame = { id: string; name?: string; kind: 'Blank' | 'Full'; date?: string; start_time: string; end_time: string; color?: string }

export function FrameModal({ open, onClose, frame, onCreate, onUpdate, onDelete, initialDate, initialTime }: { open: boolean; onClose: () => void; frame: Frame | null; onCreate?: (f: { name?: string; kind: 'Blank' | 'Full'; date?: string; start_time: string; end_time: string; color?: string }) => void; onUpdate?: (f: Frame) => void; onDelete?: (id: string) => void; initialDate?: string | Date; initialTime?: string }) {
    const now = new Date()
    const fmtTime = (d: Date) => d.toTimeString().slice(0, 5)
    const parseDate = (d?: string | Date) => {
        if (!d) return undefined
        return typeof d === 'string' ? parseYMD(d) : d
    }

    const [name, setName] = useState<string>(frame?.name ?? "")
    const [kind, setKind] = useState<'Blank' | 'Full'>(frame?.kind ?? 'Blank')
    const [date, setDate] = useState<Date | undefined>(parseDate(frame?.date ?? initialDate))
    const [startTime, setStartTime] = useState<string>(frame?.start_time ?? (initialTime ?? fmtTime(now)))
    const [endTime, setEndTime] = useState<string>(frame?.end_time ?? fmtTime(new Date(now.getTime() + 30 * 60 * 1000)))
    const [color, setColor] = useState<string>(frame?.color ?? "#60A5FA")

    React.useEffect(() => {
        if (open) {
            setName(frame?.name ?? '')
            setKind(frame?.kind ?? 'Blank')
            setDate(parseDate(frame?.date ?? initialDate))
            setStartTime(frame?.start_time ?? (initialTime ?? fmtTime(now)))
            setEndTime(frame?.end_time ?? fmtTime(new Date(now.getTime() + 30 * 60 * 1000)))
            setColor(frame?.color ?? '#60A5FA')
        }
    }, [frame, open, initialDate, initialTime])

    if (!open) return null

    function handleSave() {
        if (frame) {
            const updated: Frame = { ...frame, name: name.trim() || undefined, kind, date: date ? formatLocalDate(date) : undefined, start_time: startTime, end_time: endTime, color }
            onUpdate && onUpdate(updated)
            onClose()
        } else {
            const payload = { name: name.trim() || undefined, kind, date: date ? formatLocalDate(date) : undefined, start_time: startTime, end_time: endTime, color }
            onCreate && onCreate(payload)
            onClose()
        }
    }

    function handleDelete() {
        if (!frame) return
        onDelete && onDelete(frame.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
                <h3 className="mb-4 text-lg font-semibold">{frame ? 'Edit Frame' : 'New Frame'}</h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm">Name (optional)</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Frame name" />
                    </div>

                    <div>
                        <label className="block text-sm">Type</label>
                        <div className="mt-1 flex gap-3">
                            <label className="inline-flex items-center gap-2">
                                <input type="radio" name="frame-kind" value="Blank" checked={kind === 'Blank'} onChange={() => setKind('Blank')} />
                                <span className="text-sm">Blank (free)</span>
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="radio" name="frame-kind" value="Full" checked={kind === 'Full'} onChange={() => setKind('Full')} />
                                <span className="text-sm">Full (scheduled)</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm">Date</label>
                        <div className="mt-1">
                            <Popover className="relative">
                                <Popover.Button className="w-full text-left rounded border px-3 py-2">{date ? date.toDateString() : 'Select date'}</Popover.Button>
                                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                                    <div className="rounded bg-white p-4 shadow max-w-full">
                                        <DayPicker mode="single" selected={date} onSelect={(d) => setDate(d ?? undefined)} />
                                    </div>
                                </Popover.Panel>
                            </Popover>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <label className="block text-sm">Start</label>
                            <div className="mt-1 rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                <Popover className="relative">
                                    <Popover.Button className="w-full text-left px-3 py-2 text-sm">{startTime}</Popover.Button>
                                    <Popover.Panel className="absolute z-50 mt-2 left-0 w-40">
                                        <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                            <div className="max-h-56 overflow-auto">
                                                {buildTimeOptions().map((opt) => (
                                                    <button key={opt.value} type="button" onClick={() => setStartTime(opt.value)} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${startTime === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </Popover.Panel>
                                </Popover>
                            </div>
                        </div>

                        <div className="w-1/2">
                            <label className="block text-sm">End</label>
                            <div className="mt-1 rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                <Popover className="relative">
                                    <Popover.Button className="w-full text-left px-3 py-2 text-sm">{endTime}</Popover.Button>
                                    <Popover.Panel className="absolute z-50 mt-2 left-0 w-40">
                                        <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                            <div className="max-h-56 overflow-auto">
                                                {buildTimeOptions().map((opt) => (
                                                    <button key={opt.value} type="button" onClick={() => setEndTime(opt.value)} className={`w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 ${endTime === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </Popover.Panel>
                                </Popover>
                            </div>
                        </div>
                    </div>

                    {kind === 'Full' && (
                        <div>
                            <label className="block text-sm">Color (optional)</label>
                            <input value={color} onChange={(e) => setColor(e.target.value)} className="w-full rounded border px-3 py-2" />
                        </div>
                    )}

                    <div className="mt-4 flex justify-between items-center">
                        <div>
                            <button className="px-4 py-2" onClick={onClose}>Cancel</button>
                            <button className="ml-2 rounded bg-blue-600 px-4 py-2 text-white" onClick={handleSave}>Save</button>
                        </div>
                        <div>
                            {frame && <button className="text-red-600 text-sm" onClick={handleDelete}>Delete frame</button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
