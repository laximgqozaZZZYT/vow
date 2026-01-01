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

type Goal = { id: string; name: string; details?: string; dueDate?: string | Date | null; parentId?: string | null }

export function GoalModal({ open, onClose, goal, onUpdate, onDelete, onCreate, goals }: { open: boolean; onClose: () => void; goal: Goal | null; onUpdate?: (g: Goal) => void; onDelete?: (id: string) => void; onCreate?: (payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => void; goals?: Goal[] }) {
    const [name, setName] = useState(goal?.name ?? "")
    const [details, setDetails] = useState(goal?.details ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
    const [parentId, setParentId] = useState<string | null>(goal?.parentId ?? null)

    React.useEffect(() => {
        if (open) {
            setName(goal?.name ?? '')
            setDetails(goal?.details ?? '')
            setDueDate(goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
            setParentId(goal?.parentId ?? null)
        }
    }, [goal, open])

    if (!open) return null

    function handleSave() {
        if (goal) {
            const updated: Goal = { ...goal, name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId }
            onUpdate && onUpdate(updated)
            onClose()
        } else {
            const payload = { name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId: parentId ?? undefined }
            onCreate && onCreate(payload)
            onClose()
        }
    }

    function handleDelete() {
        if (!goal) return
        onDelete && onDelete(goal.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded bg-white p-6 shadow-lg text-black dark:bg-slate-900 dark:text-slate-100">
                <h3 className="mb-4 text-lg font-semibold">{goal ? 'Edit Goal' : 'New Goal'}</h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm">Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Goal name" />
                    </div>

                    <div>
                        <label className="block text-sm">Details</label>
                        <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="w-full rounded border px-3 py-2" placeholder="Optional details" />
                    </div>

                    <div>
                        <label className="block text-sm">Due date</label>
                        <div className="mt-1">
                            <Popover className="relative">
                                <Popover.Button className="w-full text-left rounded border px-3 py-2">{dueDate ? dueDate.toDateString() : "Select date"}</Popover.Button>
                                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                                    <div className="rounded bg-white p-4 shadow max-w-full">
                                        <DayPicker mode="single" selected={dueDate} onSelect={(d) => setDueDate(d ?? undefined)} />
                                    </div>
                                </Popover.Panel>
                            </Popover>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm">Parent goal (optional)</label>
                        <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)} className="w-full rounded border px-3 py-2 mt-1">
                            <option value="">(no parent)</option>
                            {goals?.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                        <div>
                            <button className="px-4 py-2" onClick={onClose}>Cancel</button>
                            <button className="ml-2 rounded bg-blue-600 px-4 py-2 text-white" onClick={handleSave}>Save</button>
                        </div>
                        <div>
                            {goal && <button className="text-red-600 text-sm" onClick={handleDelete}>Delete goal</button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
