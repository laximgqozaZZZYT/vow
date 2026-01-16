"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import TagSelector from './Widget.TagSelector'
import { supabaseDirectClient } from '../../../lib/supabase-direct'

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

type Goal = { id: string; name: string; details?: string; dueDate?: string | Date | null; parentId?: string | null; isCompleted?: boolean }

export function GoalModal({ open, onClose, goal, onUpdate, onDelete, onCreate, onComplete, goals, tags, onTagsChange, initial }: { open: boolean; onClose: () => void; goal: Goal | null; onUpdate?: (g: Goal) => void; onDelete?: (id: string) => void; onCreate?: (payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => void; onComplete?: (goalId: string) => void; goals?: Goal[]; tags?: any[]; onTagsChange?: (goalId: string, tagIds: string[]) => Promise<void>; initial?: { name?: string; parentId?: string | null } }) {
    const [name, setName] = useState(goal?.name ?? "")
    const [details, setDetails] = useState(goal?.details ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
    const [parentId, setParentId] = useState<string | null>(goal?.parentId ?? null)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

    React.useEffect(() => {
        if (open) {
            if (goal) {
                setName(goal.name ?? '')
                setDetails(goal.details ?? '')
                setDueDate(goal.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
                setParentId(goal.parentId ?? null)
                loadGoalTags(goal.id)
            } else {
                // 新規作成時は initial の値を使用
                setName(initial?.name ?? '')
                setDetails('')
                setDueDate(undefined)
                setParentId(initial?.parentId ?? null)
                setSelectedTagIds([])
            }
        }
    }, [goal, open, initial])

    // Load goal tags
    async function loadGoalTags(goalId: string) {
        try {
            const goalTags = await supabaseDirectClient.getGoalTags(goalId)
            setSelectedTagIds(goalTags.map((t: any) => t.id))
        } catch (err) {
            console.error('[GoalModal] loadGoalTags error', err)
        }
    }

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

    function handleComplete() {
        if (!goal) return
        onComplete && onComplete(goal.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg text-card-foreground">
                <h3 className="mb-4 text-lg font-semibold">{goal ? 'Edit Goal' : 'New Goal'}</h3>

                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" placeholder="Goal name" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Details</label>
                        <textarea value={details} onChange={(e) => setDetails(e.target.value)} className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" placeholder="Optional details" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Due date</label>
                        <div className="mt-1">
                            <Popover className="relative">
                                <Popover.Button className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{dueDate ? dueDate.toDateString() : "Select date"}</Popover.Button>
                                <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                                    <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-full">
                                        <DayPicker mode="single" selected={dueDate} onSelect={(d) => setDueDate(d ?? undefined)} />
                                    </div>
                                </Popover.Panel>
                            </Popover>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Parent goal (optional)</label>
                        <select value={parentId ?? ''} onChange={(e) => setParentId(e.target.value || null)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <option value="">(no parent)</option>
                            {goals?.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tags */}
                    {tags && tags.length > 0 && (
                        <div>
                            <label className="block text-sm mb-2">Tags</label>
                            <TagSelector
                                availableTags={tags}
                                selectedTagIds={selectedTagIds}
                                onTagAdd={async (tagId) => {
                                    if (goal && onTagsChange) {
                                        const newTagIds = [...selectedTagIds, tagId]
                                        await onTagsChange(goal.id, newTagIds)
                                        setSelectedTagIds(newTagIds)
                                    } else {
                                        setSelectedTagIds([...selectedTagIds, tagId])
                                    }
                                }}
                                onTagRemove={async (tagId) => {
                                    if (goal && onTagsChange) {
                                        const newTagIds = selectedTagIds.filter(id => id !== tagId)
                                        await onTagsChange(goal.id, newTagIds)
                                        setSelectedTagIds(newTagIds)
                                    } else {
                                        setSelectedTagIds(selectedTagIds.filter(id => id !== tagId))
                                    }
                                }}
                                placeholder="Search and add tags..."
                            />
                        </div>
                    )}

                    <div className="mt-6 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={onClose}>Cancel</button>
                            <button className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={handleSave}>Save</button>
                            {goal && <button className="inline-flex items-center justify-center rounded-md bg-success px-4 py-2 text-sm font-medium text-success-foreground transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={handleComplete}>Completed</button>}
                        </div>
                        <div>
                            {goal && <button className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={handleDelete}>Delete goal</button>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
