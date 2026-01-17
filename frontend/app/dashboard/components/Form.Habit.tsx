"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import TagSelector from './Widget.TagSelector'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { useLocale } from '../../contexts/LocaleContext'

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

function buildTimeOptions() {
    const opts: { label: string; value: string }[] = []
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const d = new Date()
            d.setHours(h, m, 0, 0)
            const label = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
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

type ViewMode = 'normal' | 'detail'

type Habit = { 
    id: string; 
    goalId: string; 
    name: string; 
    active: boolean; 
    type: "do" | "avoid"; 
    count: number; 
    must?: number; 
    duration?: number; 
    reminders?: any[]; 
    dueDate?: string; 
    time?: string; 
    endTime?: string; 
    repeat?: string; 
    allDay?: boolean; 
    notes?: string; 
    createdAt: string; 
    updatedAt: string; 
    workloadUnit?: string; 
    workloadTotal?: number; 
    workloadTotalEnd?: number; 
    workloadPerCount?: number;
    timings?: Timing[];
    outdates?: Timing[];
}

interface HabitFormProps {
    habit: Habit | null;
    goals?: { id: string; name: string }[];
    tags?: any[];
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    onSave: (habitData: any) => void;
    showViewModeToggle?: boolean;
}

// CollapsibleSection component for Normal View
function CollapsibleSection({ 
    title, 
    isExpanded, 
    onToggle, 
    children 
}: { 
    title: string
    isExpanded: boolean
    onToggle: () => void
    children: React.ReactNode 
}) {
    return (
        <div className="mt-4">
            <button
                onClick={onToggle}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-2 min-h-[44px]"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            >
                <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">{title}</span>
            </button>
            {isExpanded && (
                <div className="mt-2 animate-fadeIn">
                    {children}
                </div>
            )}
        </div>
    )
}

export function HabitForm({ habit, goals, tags, viewMode, onViewModeChange, onSave, showViewModeToggle = true }: HabitFormProps) {
    const { t } = useLocale()
    
    // Expanded sections state
    const [expandedSections, setExpandedSections] = React.useState({
        workload: false,
        outdates: false,
        type: false,
        goal: false,
        relatedHabits: false
    })
    
    const [name, setName] = useState<string>(habit?.name ?? "")
    const [notes, setNotes] = useState<string>(habit?.notes ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(habit?.dueDate ? new Date(habit.dueDate) : undefined)
    const [time, setTime] = useState<string | undefined>(habit?.time ?? undefined)
    const [endTime, setEndTime] = useState<string | undefined>(habit?.endTime ?? undefined)
    const [allDay, setAllDay] = useState<boolean>(!!habit?.allDay)
    const [active, setActive] = useState<boolean>(!!habit?.active)
    const [type, setType] = useState<"do" | "avoid">(habit?.type ?? "do")
    const [workloadUnit, setWorkloadUnit] = useState<string>((habit as any)?.workloadUnit ?? '')
    const [workloadTotal, setWorkloadTotal] = useState<string>(String((habit as any)?.workloadTotal ?? (habit as any)?.must ?? ''))
    const [workloadTotalEnd, setWorkloadTotalEnd] = useState<string>(String((habit as any)?.workloadTotalEnd ?? ''))
    const [workloadPerCount, setWorkloadPerCount] = useState<string>(String((habit as any)?.workloadPerCount ?? 1))
    const [goalId, setGoalId] = useState<string | undefined>(habit?.goalId)
    const [timings, setTimings] = useState<Timing[]>((habit?.timings ?? [{ type: 'Daily' }]) as Timing[])
    const [outdates, setOutdates] = useState<Timing[]>((habit?.outdates ?? []) as Timing[])
    const [showOutdates, setShowOutdates] = useState<boolean>(false)
    const [timingType, setTimingType] = useState<TimingType>(habit?.dueDate ? 'Date' : 'Daily')
    
    // Related habits
    const [allHabits, setAllHabits] = useState<Habit[]>([])
    const [relations, setRelations] = useState<any[]>([])
    const [selectedRelatedHabitId, setSelectedRelatedHabitId] = useState<string>('')
    const [selectedRelationType, setSelectedRelationType] = useState<'main'|'sub'|'next'>('main')
    const [loadingRelations, setLoadingRelations] = useState(false)
    
    // Tags
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    
    const toggleSection = React.useCallback((section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }, [])
    
    // Load data
    React.useEffect(() => {
        if (habit) {
            loadAllHabits()
            loadRelations()
            loadHabitTags(habit.id)
        }
    }, [habit?.id])
    
    async function loadAllHabits() {
        try {
            const h = await supabaseDirectClient.getHabits()
            setAllHabits(Array.isArray(h) ? h : [])
        } catch (err) {
            console.error('[HabitForm] loadAllHabits error', err)
        }
    }
    
    async function loadRelations() {
        if (!habit) return
        setLoadingRelations(true)
        try {
            const r = await supabaseDirectClient.getHabitRelations(habit.id)
            setRelations(Array.isArray(r) ? r : [])
        } catch (err) {
            console.error('[HabitForm] loadRelations error', err)
        } finally {
            setLoadingRelations(false)
        }
    }
    
    async function loadHabitTags(habitId: string) {
        try {
            const habitTags = await supabaseDirectClient.getHabitTags(habitId)
            setSelectedTagIds(habitTags.map((t: any) => t.id))
        } catch (err) {
            console.error('[HabitForm] loadHabitTags error', err)
        }
    }
    
    async function handleAddRelation() {
        if (!habit || !selectedRelatedHabitId) return
        try {
            await supabaseDirectClient.createHabitRelation({ 
                habitId: habit.id, 
                relatedHabitId: selectedRelatedHabitId, 
                relation: selectedRelationType 
            })
            setSelectedRelatedHabitId('')
            await loadRelations()
        } catch (err) {
            console.error('[HabitForm] create relation error', err)
        }
    }
    
    async function handleDeleteRelation(id: string) {
        try {
            await supabaseDirectClient.deleteHabitRelation(id)
            await loadRelations()
        } catch (err) {
            console.error('[HabitForm] delete relation error', err)
        }
    }
    
    // Auto-save on blur
    const handleAutoSave = React.useCallback(() => {
        const habitData = {
            name: name.trim() || "Untitled",
            notes: notes.trim() || undefined,
            dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
            time,
            endTime,
            allDay,
            active,
            type,
            goalId,
            workloadUnit: workloadUnit || undefined,
            workloadTotal: workloadTotal ? Number(workloadTotal) : undefined,
            workloadTotalEnd: workloadTotalEnd ? Number(workloadTotalEnd) : undefined,
            workloadPerCount: Number(workloadPerCount) || 1,
            timings,
            outdates,
        }
        onSave(habitData)
    }, [name, notes, dueDate, time, endTime, allDay, active, type, goalId, workloadUnit, workloadTotal, workloadTotalEnd, workloadPerCount, timings, outdates, onSave])
    
    const estimatedDaysToTotalEnd = React.useMemo(() => {
        const endTotalNum = Number(workloadTotalEnd)
        const dayTotalNum = Number(workloadTotal)
        if (!endTotalNum || !dayTotalNum || dayTotalNum <= 0) return null
        return Math.ceil(endTotalNum / dayTotalNum)
    }, [workloadTotalEnd, workloadTotal])

    return (
        <div className="space-y-4">
            {/* View Mode Toggle */}
            {showViewModeToggle && (
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Habit Details</h3>
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
                    placeholder="Habit name" 
                />
            </div>
            
            {/* Description - Always visible */}
            <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    onBlur={handleAutoSave}
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                    placeholder="Add description" 
                />
            </div>
            
            {/* Tags - Always visible */}
            {tags && tags.length > 0 && (
                <div>
                    <label className="block text-sm font-medium mb-2">Tags</label>
                    <TagSelector
                        availableTags={tags}
                        selectedTagIds={selectedTagIds}
                        onTagAdd={async (tagId) => {
                            if (habit) {
                                const newTagIds = [...selectedTagIds, tagId]
                                await supabaseDirectClient.setHabitTags(habit.id, newTagIds)
                                setSelectedTagIds(newTagIds)
                            }
                        }}
                        onTagRemove={async (tagId) => {
                            if (habit) {
                                const newTagIds = selectedTagIds.filter(id => id !== tagId)
                                await supabaseDirectClient.setHabitTags(habit.id, newTagIds)
                                setSelectedTagIds(newTagIds)
                            }
                        }}
                        placeholder="Search and add tags..."
                    />
                </div>
            )}
            
            {/* Conditional sections based on viewMode */}
            {viewMode === 'detail' && (
                <>
                    {/* Workload section */}
                    <div>
                        <h3 className="text-lg font-medium mb-2">Workload</h3>
                        {estimatedDaysToTotalEnd !== null && (
                            <div className="text-sm text-slate-400 mb-2">
                                Estimated days to reach Load Total(End): <span className="font-semibold">{estimatedDaysToTotalEnd}</span> days
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1">Unit</label>
                                <input 
                                    value={workloadUnit} 
                                    onChange={(e) => setWorkloadUnit(e.target.value)} 
                                    onBlur={handleAutoSave}
                                    placeholder="e.g. hrs, pages" 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Load per Count</label>
                                <input 
                                    type="number" 
                                    min={1} 
                                    value={workloadPerCount} 
                                    onChange={(e) => setWorkloadPerCount(e.target.value)} 
                                    onBlur={handleAutoSave}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Load Total(Day)</label>
                                <input 
                                    type="number" 
                                    min={0} 
                                    value={workloadTotal} 
                                    onChange={(e) => setWorkloadTotal(e.target.value)} 
                                    onBlur={handleAutoSave}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Type section */}
                    <div>
                        <h3 className="text-lg font-medium mb-2">Type</h3>
                        <div className="flex gap-6">
                            <label className="inline-flex items-center gap-3">
                                <input
                                    type="radio"
                                    value="do"
                                    checked={type === 'do'}
                                    onChange={() => {
                                        setType('do')
                                        setTimeout(handleAutoSave, 100)
                                    }}
                                    className="form-radio w-5 h-5"
                                />
                                <span>Good</span>
                            </label>
                            <label className="inline-flex items-center gap-3">
                                <input
                                    type="radio"
                                    value="avoid"
                                    checked={type === 'avoid'}
                                    onChange={() => {
                                        setType('avoid')
                                        setTimeout(handleAutoSave, 100)
                                    }}
                                    className="form-radio w-5 h-5"
                                />
                                <span>Bad</span>
                            </label>
                        </div>
                    </div>
                    
                    {/* Goal section */}
                    <div>
                        <h3 className="text-lg font-medium mb-2">Goal</h3>
                        <select 
                            value={goalId} 
                            onChange={(e) => {
                                setGoalId(e.target.value)
                                setTimeout(handleAutoSave, 100)
                            }} 
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            {(goals ?? []).map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Related Habits section */}
                    {habit && (
                        <div>
                            <h3 className="text-lg font-medium mb-2">Related Habits</h3>
                            <div className="space-y-2">
                                {loadingRelations && <div className="text-sm text-slate-500">Loading...</div>}
                                {!loadingRelations && relations.length === 0 && <div className="text-sm text-slate-500">No related habits.</div>}
                                {relations.map((r) => {
                                    const other = allHabits.find(h => h.id === r.relatedHabitId) || { name: r.relatedHabitId }
                                    return (
                                        <div key={r.id} className="flex items-center justify-between rounded px-2 py-2 border">
                                            <div className="text-sm">
                                                <span className="font-medium">{other.name}</span> 
                                                <span className="text-xs text-slate-500"> ({r.relation})</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => handleDeleteRelation(r.id)} 
                                                className="text-red-600 text-sm"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )
                                })}
                                <div className="flex gap-2 items-center">
                                    <select 
                                        value={selectedRelatedHabitId} 
                                        onChange={(e) => setSelectedRelatedHabitId(e.target.value)} 
                                        className="flex-1 rounded border px-2 py-1 bg-background"
                                    >
                                        <option value="">Select habit...</option>
                                        {allHabits.filter(h => h.id !== habit?.id).map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </select>
                                    <select 
                                        value={selectedRelationType} 
                                        onChange={(e) => setSelectedRelationType(e.target.value as any)} 
                                        className="rounded border px-2 py-1 bg-background"
                                    >
                                        <option value="main">Main</option>
                                        <option value="sub">Sub</option>
                                        <option value="next">Next</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleAddRelation}
                                        className="rounded bg-blue-600 px-3 py-1 text-white text-sm"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
