"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import TagSelector from './Widget.TagSelector'
import { supabaseDirectClient } from '../../../lib/supabase-direct'

// Helper functions
function formatLocalDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

type ViewMode = 'normal' | 'detail'

type Goal = { 
    id: string; 
    name: string; 
    details?: string; 
    dueDate?: string | Date | null; 
    parentId?: string | null; 
    isCompleted?: boolean 
}

interface GoalFormProps {
    goal: Goal | null;
    goals?: Goal[];
    tags?: any[];
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onSave: (goalData: any) => void;
    showViewModeToggle?: boolean;
}

export function GoalForm({ goal, goals, tags, viewMode, onViewModeChange, onSave, showViewModeToggle = true }: GoalFormProps) {
    const [name, setName] = useState(goal?.name ?? "")
    const [details, setDetails] = useState(goal?.details ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(
        goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined
    )
    const [parentId, setParentId] = useState<string | null>(goal?.parentId ?? null)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

    React.useEffect(() => {
        if (goal) {
            loadGoalTags(goal.id)
        }
    }, [goal?.id])

    async function loadGoalTags(goalId: string) {
        try {
            const goalTags = await supabaseDirectClient.getGoalTags(goalId)
            setSelectedTagIds(goalTags.map((t: any) => t.id))
        } catch (err) {
            console.error('[GoalForm] loadGoalTags error', err)
        }
    }

    const handleAutoSave = React.useCallback(() => {
        const goalData = {
            name: name.trim() || 'Untitled',
            details: details.trim() || undefined,
            dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
            parentId
        }
        onSave(goalData)
    }, [name, details, dueDate, parentId, onSave])

    return (
        <div className="space-y-4">
            {/* View Mode Toggle */}
            {showViewModeToggle && (
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Goal Details</h3>
                    <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                        <button 
                            onClick={() => onViewModeChange('normal')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                                viewMode === 'normal' 
                                    ? 'bg-white dark:bg-slate-700 shadow-sm' 
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Basic
                        </button>
                        <button 
                            onClick={() => onViewModeChange('detail')}
                            className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                                viewMode === 'detail' 
                                    ? 'bg-white dark:bg-slate-700 shadow-sm' 
                                    : 'text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            Detail
                        </button>
                    </div>
                </div>
            )}

            {/* Name - Always visible */}
            <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    onBlur={handleAutoSave}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                    placeholder="Goal name" 
                />
            </div>

            {/* Details - Always visible */}
            <div>
                <label className="block text-sm font-medium mb-1">Details</label>
                <textarea 
                    value={details} 
                    onChange={(e) => setDetails(e.target.value)} 
                    onBlur={handleAutoSave}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                    placeholder="Optional details" 
                />
            </div>

            {/* Due date - Always visible */}
            <div>
                <label className="block text-sm font-medium mb-1">Due date</label>
                <Popover className="relative">
                    <Popover.Button className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {dueDate ? dueDate.toDateString() : "Select date"}
                    </Popover.Button>
                    <Popover.Panel className="absolute z-10 mt-2 left-0 w-[min(520px,90vw)]">
                        <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-full">
                            <DayPicker 
                                mode="single" 
                                selected={dueDate} 
                                onSelect={(d) => {
                                    setDueDate(d ?? undefined)
                                    setTimeout(handleAutoSave, 100)
                                }} 
                            />
                        </div>
                    </Popover.Panel>
                </Popover>
            </div>

            {/* Parent goal - Always visible */}
            <div>
                <label className="block text-sm font-medium mb-1">Parent goal (optional)</label>
                <select 
                    value={parentId ?? ''} 
                    onChange={(e) => {
                        setParentId(e.target.value || null)
                        setTimeout(handleAutoSave, 100)
                    }} 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="">(no parent)</option>
                    {goals?.filter(g => !goal || g.id !== goal.id).map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                </select>
            </div>

            {/* Tags - Always visible */}
            {tags && tags.length > 0 && (
                <div>
                    <label className="block text-sm mb-2">Tags</label>
                    <TagSelector
                        availableTags={tags}
                        selectedTagIds={selectedTagIds}
                        onTagAdd={async (tagId) => {
                            if (goal) {
                                const newTagIds = [...selectedTagIds, tagId]
                                await supabaseDirectClient.setGoalTags(goal.id, newTagIds)
                                setSelectedTagIds(newTagIds)
                            }
                        }}
                        onTagRemove={async (tagId) => {
                            if (goal) {
                                const newTagIds = selectedTagIds.filter(id => id !== tagId)
                                await supabaseDirectClient.setGoalTags(goal.id, newTagIds)
                                setSelectedTagIds(newTagIds)
                            }
                        }}
                        placeholder="Search and add tags..."
                    />
                </div>
            )}
        </div>
    )
}
