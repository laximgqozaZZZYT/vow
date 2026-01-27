"use client"

import React from "react"
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { supabase } from '../../../lib/supabaseClient'
import { debug } from '../../../lib/debug'
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import SmartSelector, { SmartSelectorItem } from './Widget.SmartSelector'
import StickyFooter from './Widget.StickyFooter'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useLocale } from '@/contexts/LocaleContext'
import LevelAssessmentSliders, { type LevelVariables } from './Widget.LevelAssessmentSliders'

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

type ExpandedSections = {
    workload: boolean
    outdates: boolean
    type: boolean
    goal: boolean
    relatedHabits: boolean
}

type Habit = { id: string; goalId: string; name: string; active: boolean; type: "do" | "avoid"; count: number; must?: number; duration?: number; reminders?: ({ kind: 'absolute'; time: string; weekdays: string[] } | { kind: 'relative'; minutesBefore: number })[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; allDay?: boolean; notes?: string; createdAt: string; updatedAt: string; workloadUnit?: string; workloadTotal?: number; workloadTotalEnd?: number; workloadPerCount?: number }

type CreateHabitPayload = { name: string; goalId?: string; type: "do" | "avoid"; duration?: number; reminders?: any[]; dueDate?: string; time?: string; endTime?: string; repeat?: string; timings?: any[]; allDay?: boolean; notes?: string; workloadUnit?: string; workloadTotal?: number; workloadTotalEnd?: number; workloadPerCount?: number; relatedHabitIds?: string[] }

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

export function HabitModal({ open, onClose, habit, onUpdate, onDelete, onCreate, initial, categories: goals, tags, onTagsChange }: { open: boolean; onClose: () => void; habit: Habit | null; onUpdate?: (h: Habit) => void; onDelete?: (id: string) => void; onCreate?: (payload: CreateHabitPayload) => void; initial?: { name?: string; date?: string; time?: string; endTime?: string; type?: "do" | "avoid"; goalId?: string; relatedHabitIds?: string[] }; categories?: { id: string; name: string }[]; tags?: any[]; onTagsChange?: (habitId: string, tagIds: string[]) => Promise<void> }) {
    // Locale
    const { t } = useLocale()
    
    // View mode state with localStorage persistence
    const { value: viewMode, setValue: setViewMode } = useLocalStorage<ViewMode>('habitModalViewMode', { defaultValue: 'normal' })
    
    // Expanded sections state (session-only, not persisted)
    const [expandedSections, setExpandedSections] = React.useState<ExpandedSections>({
        workload: false,
        outdates: false,
        type: false,
        goal: false,
        relatedHabits: false
    })
    
    const [name, setName] = React.useState<string>(habit?.name ?? "")
    const [notes, setNotes] = React.useState<string>(habit?.notes ?? "")
    const [dueDate, setDueDate] = React.useState<Date | undefined>(habit?.dueDate ? new Date(habit.dueDate) : undefined)
    const [time, setTime] = React.useState<string | undefined>(habit?.time ?? undefined)
    const [endTime, setEndTime] = React.useState<string | undefined>(undefined)
    const [allDay, setAllDay] = React.useState<boolean>(!!habit?.allDay)
    const [active, setActive] = React.useState<boolean>(!!habit?.active)
    const [type, setType] = React.useState<"do" | "avoid">(habit?.type ?? "do")
    // workload fields replace the old Policy concept
    const [workloadUnit, setWorkloadUnit] = React.useState<string>('')
    const [workloadTotal, setWorkloadTotal] = React.useState<string>('')
    const [workloadTotalEnd, setWorkloadTotalEnd] = React.useState<string>('')
    const [workloadPerCount, setWorkloadPerCount] = React.useState<string>('1')
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

    // Related habits UI state
    type HabitRelation = { id: string; habitId: string; relatedHabitId: string; relation: 'main' | 'sub' | 'next'; createdAt?: string; updatedAt?: string }
    const [allHabits, setAllHabits] = React.useState<Habit[]>([])
    const [relations, setRelations] = React.useState<HabitRelation[]>([])
    const [selectedRelatedHabitId, setSelectedRelatedHabitId] = React.useState<string>('')
    const [selectedRelationType, setSelectedRelationType] = React.useState<'main'|'sub'|'next'>('main')
    const [loadingRelations, setLoadingRelations] = React.useState(false)

    // Tags state
    const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])

    // Level assessment state
    const [showLevelAssessment, setShowLevelAssessment] = React.useState(false)
    const [levelAssessmentLoading, setLevelAssessmentLoading] = React.useState(false)

    // Toggle view mode
    const toggleViewMode = React.useCallback(() => {
        setViewMode(viewMode === 'normal' ? 'detail' : 'normal')
    }, [viewMode, setViewMode])

    // Toggle individual section expansion
    const toggleSection = React.useCallback((section: keyof ExpandedSections) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }))
    }, [])

    // Level assessment handler
    const handleLevelAssessmentSubmit = React.useCallback(async (habitId: string, variables: LevelVariables, level: number) => {
        setLevelAssessmentLoading(true)
        try {
            if (!supabase) {
                console.error('Supabase not initialized')
                alert('Supabaseが初期化されていません')
                return
            }

            const { data: { session } } = await supabase.auth.getSession()
            const now = new Date().toISOString()
            
            // Calculate level tier
            const levelTier = level < 50 ? 'beginner' : level < 100 ? 'intermediate' : level < 150 ? 'advanced' : 'expert'

            debug.log('[HabitModal] Saving level:', { habitId, level, levelTier, variables, isGuest: !session?.user })

            if (!session?.user) {
                // Guest mode: update localStorage
                debug.log('[HabitModal] Guest mode - updating localStorage')
                const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]')
                const habitIndex = guestHabits.findIndex((h: any) => h.id === habitId)
                
                if (habitIndex === -1) {
                    alert('習慣が見つかりません')
                    return
                }
                
                guestHabits[habitIndex] = {
                    ...guestHabits[habitIndex],
                    level,
                    levelTier,
                    levelAssessedAt: now,
                    levelAssessmentRaw: {
                        assessmentType: 'manual_slider',
                        variables,
                        level,
                        assessedAt: now,
                    },
                    updatedAt: now,
                }
                
                localStorage.setItem('guest-habits', JSON.stringify(guestHabits))
                debug.log('[HabitModal] Guest level saved successfully')
                
                // Close slider UI - the parent will reload habits data
                setShowLevelAssessment(false)
                
                // Close modal and trigger data reload
                onClose()
                return
            }

            // Authenticated mode: update Supabase
            const { data: updateData, error } = await supabase
                .from('habits')
                .update({
                    level,
                    level_tier: levelTier,
                    level_assessed_at: now,
                    level_assessment_raw: {
                        assessmentType: 'manual_slider',
                        variables,
                        level,
                        assessedAt: now,
                    },
                    updated_at: now,
                })
                .eq('id', habitId)
                .eq('owner_id', session.user.id)
                .select()

            if (error) {
                console.error('[HabitModal] Level save error:', error)
                alert(`レベルの保存に失敗しました: ${error.message}`)
                return
            }

            debug.log('[HabitModal] Level saved successfully:', updateData)

            // Record in level_history (don't fail if this errors)
            try {
                await supabase.from('level_history').insert({
                    habit_id: habitId,
                    user_id: session.user.id,
                    old_level: (habit as any)?.level ?? null,
                    new_level: level,
                    change_reason: 'manual_adjustment',
                    workload_delta: variables,
                })
            } catch (historyErr) {
                console.warn('[HabitModal] Failed to record level history:', historyErr)
            }

            // Close slider UI - the parent will reload habits data
            setShowLevelAssessment(false)
            
            // Close modal and trigger data reload
            onClose()
        } catch (err) {
            console.error('Failed to save level:', err)
            alert(`エラーが発生しました: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setLevelAssessmentLoading(false)
        }
    }, [habit, onClose])

    async function loadAllHabits() {
        try {
            const h = await supabaseDirectClient.getHabits()
            setAllHabits(Array.isArray(h) ? h : [])
        } catch (err) {
            console.error('[HabitModal] loadAllHabits error', err)
        }
    }

    async function loadRelations() {
        if (!habit) {
            setRelations([])
            return
        }
        setLoadingRelations(true)
        try {
            const r = await supabaseDirectClient.getHabitRelations(habit.id)
            setRelations(Array.isArray(r) ? r : [])
        } catch (err) {
            console.error('[HabitModal] loadRelations error', err)
        } finally {
            setLoadingRelations(false)
        }
    }

    React.useEffect(() => {
        if (!open) return
        loadAllHabits()
        loadRelations()
    }, [open, habit?.id])

    async function handleAddRelation() {
        if (!habit) return
        if (!selectedRelatedHabitId) return
        try {
            await supabaseDirectClient.createHabitRelation({ habitId: habit.id, relatedHabitId: selectedRelatedHabitId, relation: selectedRelationType })
            setSelectedRelatedHabitId('')
            await loadRelations()
        } catch (err) {
            console.error('[HabitModal] create relation error', err)
        }
    }

    async function handleDeleteRelation(id: string) {
        try {
            await supabaseDirectClient.deleteHabitRelation(id)
            await loadRelations()
        } catch (err) {
            console.error('[HabitModal] delete relation error', err)
        }
    }

    React.useEffect(() => {
        if (!open) return
        if (habit) {
            setWorkloadUnit((habit as any)?.workloadUnit ?? '')
            setWorkloadTotal(String((habit as any)?.workloadTotal ?? (habit as any)?.targetCount ?? (habit as any)?.must ?? ''))
            setWorkloadTotalEnd(String((habit as any)?.workloadTotalEnd ?? ''))
            setWorkloadPerCount(String((habit as any)?.workloadPerCount ?? 1))
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
            const incomingOutdates = ((habit as any)?.outdates ?? []).map((x: any) => ({ ...x }))
            setOutdates(incomingOutdates.length ? incomingOutdates : [{ type: habit?.dueDate ? 'Date' : 'Daily', date: habit?.dueDate ? (typeof habit.dueDate === 'string' ? habit.dueDate : formatLocalDate(new Date(habit.dueDate))) : undefined, start: habit?.time ?? undefined, end: habit?.endTime ?? undefined }])
            if (!((habit as any)?.timings ?? []).length) {
                const tType: TimingType = habit?.dueDate ? 'Date' : 'Daily'
                setTimings([{ type: tType, date: habit?.dueDate ? (typeof habit.dueDate === 'string' ? habit.dueDate : formatLocalDate(new Date(habit.dueDate))) : undefined, start: habit?.time ?? undefined, end: habit?.endTime ?? undefined }])
            }
            if (habit?.repeat && habit.repeat !== 'Does not repeat') {
                if (habit.repeat === 'Daily' || habit.repeat === 'Weekly' || habit.repeat === 'Monthly') {
                    setTimingType(habit.repeat as TimingType)
                }
            }
            // Load tags for this habit
            loadHabitTags(habit.id)
        } else {
            // creation defaults (use optional initial values)
            setWorkloadUnit('')
            setWorkloadTotal('')
            setWorkloadTotalEnd('')
            setWorkloadPerCount('1')
            setName(initial?.name ?? '')
            setNotes('')
            setDueDate(initial?.date ? new Date(initial.date) : undefined)
            setTime(initial?.time ?? undefined)
            setEndTime(initial?.endTime ?? undefined)
            setAllDay(false)
            setActive(true)
            setType(initial?.type ?? 'do')
            setGoalId(initial?.goalId)
            const tType: TimingType = initial?.date ? 'Date' : 'Daily'
            setTimings([{ type: tType, date: initial?.date ?? undefined, start: initial?.time ?? undefined, end: initial?.endTime ?? undefined }])
            // ensure there's at least one empty outdate row so the UI shows an editable row
            setOutdates([{ type: tType, date: initial?.date ?? undefined, start: initial?.time ?? undefined, end: initial?.endTime ?? undefined }])
            setTimingType(initial?.date ? 'Date' : 'Daily')
            setTimingWeekdays([])
            setSelectedTagIds([])
            
            // Initialize relations from initial.relatedHabitIds
            if (initial?.relatedHabitIds && initial.relatedHabitIds.length > 0) {
                const initialRelations: HabitRelation[] = initial.relatedHabitIds.map(relatedHabitId => ({
                    id: `temp-${Date.now()}-${relatedHabitId}`,
                    habitId: '', // Will be set when habit is created
                    relatedHabitId,
                    relation: 'next' as const,
                }))
                setRelations(initialRelations)
            } else {
                setRelations([])
            }
        }
    }, [habit, initial, open])

    // Load habit tags
    async function loadHabitTags(habitId: string) {
        try {
            const habitTags = await supabaseDirectClient.getHabitTags(habitId)
            setSelectedTagIds(habitTags.map((t: any) => t.id))
        } catch (err) {
            console.error('[HabitModal] loadHabitTags error', err)
        }
    }


    function minutesFromHHMM(s?: string) {
        if (!s) return null
        const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/)
        if (!m) return null
        const hh = Number(m[1])
        const mm = Number(m[2])
        if (Number.isNaN(hh) || Number.isNaN(mm)) return null
        return hh * 60 + mm
    }

    const timingDurations = React.useMemo(() => {
        // duration in minutes per timing row; if end missing, treat as 0 (meaning "unknown")
        return (timings ?? []).map((t) => {
            if (!t.start) return 0
            const s = minutesFromHHMM(t.start)
            if (s === null) return 0
            if (!t.end) return 0
            const e = minutesFromHHMM(t.end)
            if (e === null) return 0
            const d = e - s
            return d > 0 ? d : 0
        })
    }, [timings])

    const totalTimingMinutes = React.useMemo(() => timingDurations.reduce((a, b) => a + b, 0), [timingDurations])

    const autoLoadPerSetByTiming = React.useMemo(() => {
        const dayTotalNum = Number(workloadTotal)
        const dayTotal = !isNaN(dayTotalNum) && dayTotalNum > 0 ? dayTotalNum : null
        if (dayTotal === null || dayTotal <= 0) return (timings ?? []).map(() => null as number | null)
        if (!timingDurations.length) return (timings ?? []).map(() => null as number | null)

        // If we can't compute durations (sum==0), fall back to equal split across timings.
        const denom = totalTimingMinutes > 0 ? totalTimingMinutes : timingDurations.length

        return timingDurations.map((d) => {
            const w = totalTimingMinutes > 0 ? d : 1
            const v = dayTotal * (w / denom)
            return Number.isFinite(v) ? v : null
        })
    }, [timings, timingDurations, totalTimingMinutes, workloadTotal])

    const estimatedDaysToTotalEnd = React.useMemo(() => {
        const endTotalNum = Number(workloadTotalEnd)
        const dayTotalNum = Number(workloadTotal)
        const endTotal = !isNaN(endTotalNum) && endTotalNum > 0 ? endTotalNum : null
        const dayTotal = !isNaN(dayTotalNum) && dayTotalNum > 0 ? dayTotalNum : null
        if (endTotal === null || endTotal <= 0) return null
        if (dayTotal === null || dayTotal <= 0) return null
        return Math.ceil(endTotal / dayTotal)
    }, [workloadTotalEnd, workloadTotal])

    // only render the modal when open; hooks above run unconditionally to preserve order
    if (!open) return null

    function handleSave() {
        debug.log('[HabitModal] handleSave called');
        debug.log('[HabitModal] Current timings state:', timings);
        debug.log('[HabitModal] Current outdates state:', outdates);
        
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
                // workload fields
                ...(workloadUnit ? { workloadUnit } as any : {}),
                ...(workloadTotal ? { workloadTotal: Number(workloadTotal) } as any : {}),
                ...(workloadTotalEnd ? { workloadTotalEnd: Number(workloadTotalEnd) } as any : {}),
                ...(Number(workloadPerCount) || 1 ? { workloadPerCount: Number(workloadPerCount) || 1 } as any : {}),
                // Always include timings and outdates (even if empty)
                timings: timings as any,
                outdates: outdates as any,
                endTime,
                updatedAt: new Date().toISOString(),
            };

            debug.log('[HabitModal] Updated habit object:', updated);

            // recompute completed using workloadTotal/must and current count
            const totalVal = (updated as any).workloadTotal ?? (updated as any).must ?? 0;
            const currentCount = habit.count ?? 0;
            (updated as any).completed = totalVal > 0 ? (currentCount >= totalVal) : ((updated as any).completed ?? false);

            onUpdate && onUpdate(updated);
            onClose();
        } else {
            // creation flow
            let finalTimings = timings;
            
            // If timings array is empty, create a default timing based on current form values
            if (!finalTimings || finalTimings.length === 0) {
                const tType: TimingType = timingType || (dueDate ? 'Date' : 'Daily');
                finalTimings = [{
                    type: tType,
                    date: dueDate ? formatLocalDate(dueDate) : undefined,
                    start: time ?? undefined,
                    end: endTime ?? undefined
                }];
                debug.log('[HabitModal] Generated default timing for empty timings array:', finalTimings);
            }
            
            const payload: CreateHabitPayload = {
                name: name.trim() || "Untitled",
                type,
                dueDate: dueDate ? formatLocalDate(dueDate) : undefined,
                time: time ?? undefined,
                endTime,
                repeat: timingType,
                timings: finalTimings, // Use finalTimings instead of timings
                allDay,
                workloadUnit: workloadUnit || undefined,
                workloadTotal: workloadTotal ? Number(workloadTotal) : undefined,
                workloadTotalEnd: workloadTotalEnd ? Number(workloadTotalEnd) : undefined,
                workloadPerCount: Number(workloadPerCount) || 1,
                notes: notes.trim() || undefined,
                relatedHabitIds: relations.length > 0 ? relations.map(r => r.relatedHabitId) : undefined,
            };
            
            debug.log('[HabitModal] Create payload:', payload);
            
            const resolvedGoalId = goalId ?? (goals && goals.length ? goals[0].id : undefined)
            if (resolvedGoalId) payload.goalId = resolvedGoalId
            onCreate && onCreate(payload);
            onClose();
        }
    }

    function handleDelete() {
        if (habit) onDelete && onDelete(habit.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-12 bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-[720px] rounded-lg border border-border bg-card px-4 pt-4 pb-0 shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-semibold">{t('habit.title')}</h2>
                    <div className="flex items-center gap-2">
                        {/* Toggle button with icons */}
                        <div className="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                            <button 
                                onClick={() => setViewMode('normal')}
                                className={`px-3 py-2 text-sm rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                                    viewMode === 'normal' 
                                        ? 'bg-card shadow-sm border border-border' 
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Normal View (show essential fields only)"
                                aria-label="Normal View"
                                aria-pressed={viewMode === 'normal'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline">{t('habit.view.normal')}</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('detail')}
                                className={`px-3 py-2 text-sm rounded-md transition-all min-w-[44px] min-h-[44px] flex items-center justify-center gap-2 ${
                                    viewMode === 'detail' 
                                        ? 'bg-card shadow-sm border border-border' 
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Detail View (show all fields)"
                                aria-label="Detail View"
                                aria-pressed={viewMode === 'detail'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <span className="hidden sm:inline">{t('habit.view.detail')}</span>
                            </button>
                        </div>
                        <button onClick={onClose} className="text-slate-500 text-lg sm:text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
                    </div>
                </div>

                {/* Scrollable content area with modern scrollbar */}
                <style>{`
                    .habit-scroll-area { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,.6) transparent; }
                    .habit-scroll-area::-webkit-scrollbar { width: 10px; }
                    .habit-scroll-area::-webkit-scrollbar-track { background: transparent; }
                    .habit-scroll-area::-webkit-scrollbar-thumb { background: rgba(148,163,184,.6); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
                    .habit-scroll-area::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.85); }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(-10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fadeIn {
                        animation: fadeIn 0.2s ease-in-out;
                    }
                `}</style>

                <div className="mt-4 flex flex-col lg:flex-row gap-4 habit-scroll-area overflow-auto flex-1 pr-2 modal-scroll-gap">
                    <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-medium mb-3 text-slate-100">{t('habit.name')}</h3>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('habit.name.placeholder')} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" />

                        {/* Level display - only show for existing habits */}
                        {habit && (
                            <div className="mt-4">
                                <h3 className="text-base sm:text-lg font-medium mb-2 text-slate-100">Level</h3>
                                {showLevelAssessment ? (
                                    <LevelAssessmentSliders
                                        habitId={habit.id}
                                        habitName={habit.name}
                                        initialValues={(habit as any).levelAssessmentRaw?.variables}
                                        onSubmit={handleLevelAssessmentSubmit}
                                        onCancel={() => setShowLevelAssessment(false)}
                                        isLoading={levelAssessmentLoading}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border">
                                        <span className="text-sm font-medium text-foreground">
                                            {(habit as any).level !== null && (habit as any).level !== undefined 
                                                ? `Lv. ${(habit as any).level}` 
                                                : 'Lv. ???'}
                                        </span>
                                        {(habit as any).levelTier && (
                                            <span className="text-xs text-muted-foreground">
                                                ({(habit as any).levelTier === 'beginner' ? '初級' : 
                                                  (habit as any).levelTier === 'intermediate' ? '中級' : 
                                                  (habit as any).levelTier === 'advanced' ? '上級' : 
                                                  (habit as any).levelTier === 'expert' ? '達人' : ''})
                                            </span>
                                        )}
                                        <button
                                            onClick={() => setShowLevelAssessment(true)}
                                            className="ml-auto text-xs text-primary hover:underline"
                                        >
                                            手動で設定
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-8">
                            {/* Workload section - hidden in Normal View unless expanded */}
                            {viewMode === 'detail' ? (
                            <div className="mt-4">
                                <h3 className="text-lg font-medium text-slate-100">Workload</h3>
                                {estimatedDaysToTotalEnd !== null ? (
                                        <div className="text-sm text-slate-400 mb-2">Estimated days to reach Load Total(End): <span className="font-semibold text-slate-200">{estimatedDaysToTotalEnd}</span> days</div>
                                ) : null}
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Unit</div>
                                        <input value={workloadUnit} onChange={(e) => setWorkloadUnit(e.target.value)} placeholder="e.g. hrs, pages" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Load per Count</div>
                                        <input type="number" min={1} value={workloadPerCount} onChange={(e) => setWorkloadPerCount(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    </div>
                                    <div>
                                        <div className="text-sm text-slate-400 mb-2">Load Total(Day)</div>
                                        <input type="number" min={0} value={workloadTotal} onChange={(e) => setWorkloadTotal(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                    <div className="col-span-1">
                                        <div className="text-sm text-slate-400 mb-2">Load Total(End) (optional)</div>
                                        <input type="number" min={0} value={workloadTotalEnd} onChange={(e) => setWorkloadTotalEnd(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                    </div>
                                    <div className="col-span-2 text-base text-slate-500">
                                        Based on Load Total(Day), we estimate how many days it takes to reach Load Total(End).
                                    </div>
                                </div>
                            </div>
                            ) : (
                            <CollapsibleSection
                                title="Workload"
                                isExpanded={expandedSections.workload}
                                onToggle={() => toggleSection('workload')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium text-slate-100">Workload</h3>
                                    {estimatedDaysToTotalEnd !== null ? (
                                            <div className="text-sm text-slate-400 mb-2">Estimated days to reach Load Total(End): <span className="font-semibold text-slate-200">{estimatedDaysToTotalEnd}</span> days</div>
                                    ) : null}
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                        <div>
                                            <div className="text-sm text-slate-400 mb-2">Unit</div>
                                            <input value={workloadUnit} onChange={(e) => setWorkloadUnit(e.target.value)} placeholder="e.g. hrs, pages" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-400 mb-2">Load per Count</div>
                                            <input type="number" min={1} value={workloadPerCount} onChange={(e) => setWorkloadPerCount(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        </div>
                                        <div>
                                            <div className="text-sm text-slate-400 mb-2">Load Total(Day)</div>
                                            <input type="number" min={0} value={workloadTotal} onChange={(e) => setWorkloadTotal(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                                        <div className="col-span-1">
                                            <div className="text-sm text-slate-400 mb-2">Load Total(End) (optional)</div>
                                            <input type="number" min={0} value={workloadTotalEnd} onChange={(e) => setWorkloadTotalEnd(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                        </div>
                                        <div className="col-span-2 text-base text-slate-500">
                                            Based on Load Total(Day), we estimate how many days it takes to reach Load Total(End).
                                        </div>
                                    </div>
                                </div>
                            </CollapsibleSection>
                            )}
                                <div className="mt-6">
                                    <h3 className="text-lg font-medium">Timings</h3>
                                    <div className="mt-4 space-y-4">
                                        {timings.map((t, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-end gap-3 rounded px-3 py-3 border-b border-slate-200 dark:border-slate-700">
                                                <div className="w-full sm:w-32">
                                                    <div className="text-sm text-slate-500 mb-2">Timing</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-3 text-base">{t.type === 'Date' ? 'A Day' : t.type}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-36`}>
                                                                <div className="rounded bg-white p-2 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Date' } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Date' ? 'bg-sky-600 text-white' : ''}`}>A Day</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Daily' } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Daily' ? 'bg-sky-600 text-white' : ''}`}>Daily</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Weekly' } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Weekly' ? 'bg-sky-600 text-white' : ''}`}>Weekly</button>
                                                                    <button type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, type: 'Monthly' } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.type === 'Monthly' ? 'bg-sky-600 text-white' : ''}`}>Monthly</button>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-full sm:w-32">
                                                    <div className="text-sm text-slate-500 mb-2">Date</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-3 text-base">{t.date ? (parseYMD(t.date) ? parseYMD(t.date)!.toDateString() : new Date(t.date).toDateString()) : 'Select date'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-[min(380px,90vw)]`}>
                                                                <div className="rounded bg-white p-4 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <DayPicker mode="single" selected={t.date ? parseYMD(t.date) : undefined} onSelect={(d) => setTimings(s => s.map((x, i) => i === idx ? { ...x, date: d ? formatLocalDate(d) : undefined } : x))} />
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>

                                                </div>

                                                <div className="w-full sm:w-32">
                                                    <div className="text-sm text-slate-500 mb-2">Start</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-3 text-base">{t.start ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, start: opt.value } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.start === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-full sm:w-32">
                                                    <div className="text-sm text-slate-500 mb-2">End</div>
                                                    <div className="rounded border bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                        <Popover className="relative">
                                                            <Popover.Button className="w-full text-left px-3 py-3 text-base">{t.end ?? '--:--'}</Popover.Button>
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-40`}>
                                                                <div className="rounded bg-white p-3 shadow text-black dark:bg-slate-800 dark:text-slate-100 max-w-full">
                                                                    <div className="max-h-56 overflow-auto">
                                                                        {buildTimeOptions().map((opt) => (
                                                                            <button key={opt.value} type="button" onClick={() => setTimings(s => s.map((x, i) => i === idx ? { ...x, end: opt.value } : x))} className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 ${t.end === opt.value ? 'bg-sky-600 text-white' : ''}`}>{opt.label}</button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </Popover.Panel>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                <div className="w-44">
                                                    <div className="text-sm text-slate-500 mb-2">Auto Load / Set</div>
                                                    <div className="w-full rounded border px-3 py-3 bg-slate-50 text-black dark:bg-slate-900/40 dark:text-slate-100 text-base">
                                                        {autoLoadPerSetByTiming[idx] === null ? (
                                                            <span className="text-slate-400">-</span>
                                                        ) : (
                                                            <span className="font-medium">{autoLoadPerSetByTiming[idx]!.toFixed(2)} {workloadUnit || ''}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="ml-auto flex items-center gap-3">
                                                    {idx === 0 ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setTimings(s => [
                                                                ...s,
                                                                {
                                                                    type: s[0]?.type ?? 'Daily',
                                                                    // preset new rows' date from the first row (if present)
                                                                    date: s[0]?.date ?? undefined,
                                                                    start: s[0]?.start ?? undefined,
                                                                    end: s[0]?.end ?? undefined,
                                                                },
                                                            ])}
                                                            className="rounded bg-slate-100 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                            aria-label="Add row"
                                                            title="Add row"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <button type="button" onClick={() => setTimings(s => s.filter((_, i) => i !== idx))} className="p-2 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove row" title="Remove row">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            

                            {/* Outdates (collapsible) - hidden in Normal View unless expanded */}
                            {viewMode === 'detail' ? (
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
                                        }} className="rounded bg-slate-100 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Add outdate" title="Add outdate">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
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
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-36`}>
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
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-[min(380px,90vw)]`}>
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
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-40`}>
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
                                                            <Popover.Panel className={`absolute z-[10002] mt-2 left-0 w-40`}>
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
                                                            <button
                                                                type="button"
                                                                onClick={() => setOutdates(s => [
                                                                    ...s,
                                                                    {
                                                                        type: s[0]?.type ?? 'Daily',
                                                                        // preset new rows' date from the first row (if present)
                                                                        date: s[0]?.date ?? undefined,
                                                                        start: s[0]?.start ?? undefined,
                                                                        end: s[0]?.end ?? undefined,
                                                                    },
                                                                ])}
                                                                className="rounded bg-slate-100 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                                aria-label="Add outdate"
                                                                title="Add outdate"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                                </svg>
                                                            </button>
                                                            {/* Also allow deleting the first outdate row */}
                                                            <button type="button" onClick={() => setOutdates(s => s.filter((_, i) => i !== idx))} className="p-2 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove outdate" title="Remove outdate">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button type="button" onClick={() => setOutdates(s => s.filter((_, i) => i !== idx))} className="p-2 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Remove outdate" title="Remove outdate">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
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
                            ) : (
                            <CollapsibleSection
                                title="Outdates (exclude periods)"
                                isExpanded={expandedSections.outdates}
                                onToggle={() => toggleSection('outdates')}
                            >
                                <div>
                                    <p className="text-sm text-slate-500 mb-2">Expand to configure exclude periods</p>
                                </div>
                            </CollapsibleSection>
                            )}

                            {/* workload moved above */}
                        </div>

                        <div className="mt-8">
                            {/* Type section - hidden in Normal View unless expanded */}
                            {viewMode === 'detail' ? (
                            <>
                            <h3 className="text-lg font-medium">Type</h3>
                            <div className="mt-4 flex flex-col gap-4">
                                <div className="flex gap-6">
                                    <label className="inline-flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="habit-type"
                                            value="do"
                                            checked={type === 'do'}
                                            onChange={() => setType('do')}
                                            className="form-radio w-5 h-5"
                                        />
                                        <span className="text-base">Good</span>
                                    </label>

                                    <label className="inline-flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="habit-type"
                                            value="avoid"
                                            checked={type === 'avoid'}
                                            onChange={() => setType('avoid')}
                                            className="form-radio w-5 h-5"
                                        />
                                        <span className="text-base">Bad</span>
                                    </label>
                                </div>
                                <div className="text-sm text-zinc-500 mt-2">Good = show on calendar. Bad = track but hide from calendar.</div>
                            </div>
                            </>
                            ) : (
                            <CollapsibleSection
                                title="Type"
                                isExpanded={expandedSections.type}
                                onToggle={() => toggleSection('type')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium">Type</h3>
                                    <div className="mt-4 flex flex-col gap-4">
                                        <div className="flex gap-6">
                                            <label className="inline-flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="habit-type"
                                                    value="do"
                                                    checked={type === 'do'}
                                                    onChange={() => setType('do')}
                                                    className="form-radio w-5 h-5"
                                                />
                                                <span className="text-base">Good</span>
                                            </label>

                                            <label className="inline-flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    name="habit-type"
                                                    value="avoid"
                                                    checked={type === 'avoid'}
                                                    onChange={() => setType('avoid')}
                                                    className="form-radio w-5 h-5"
                                                />
                                                <span className="text-base">Bad</span>
                                            </label>
                                        </div>
                                        <div className="text-sm text-zinc-500 mt-2">Good = show on calendar. Bad = track but hide from calendar.</div>
                                    </div>
                                </div>
                            </CollapsibleSection>
                            )}
                            
                            {/* Goal section - hidden in Normal View unless expanded */}
                            {viewMode === 'detail' ? (
                                <div className="mt-6">
                                    <h3 className="text-lg font-medium mb-3">Goal</h3>
                                    <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded border px-3 py-3 bg-white text-black dark:bg-slate-800 dark:text-slate-100 text-base">
                                        {(goals ?? []).map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                            <CollapsibleSection
                                title="Goal"
                                isExpanded={expandedSections.goal}
                                onToggle={() => toggleSection('goal')}
                            >
                                <div>
                                    <h3 className="text-lg font-medium mb-3">Goal</h3>
                                    <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className="w-full rounded border px-3 py-3 bg-white text-black dark:bg-slate-800 dark:text-slate-100 text-base">
                                        {(goals ?? []).map((c) => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </CollapsibleSection>
                            )}

                                {/* Description - always visible */}
                                <div className="mt-6">
                                    <h3 className="text-lg font-medium">Description</h3>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" placeholder="Add description" />
                                </div>

                                {/* Tags - SmartSelector */}
                                {tags && tags.length > 0 && (
                                    <div className="mt-6">
                                        <SmartSelector
                                            items={tags.map((tag: any) => ({
                                                id: tag.id,
                                                name: tag.name,
                                                color: tag.color
                                            }))}
                                            selectedIds={selectedTagIds}
                                            onSelect={async (tagId) => {
                                                if (habit && onTagsChange) {
                                                    const newTagIds = [...selectedTagIds, tagId]
                                                    await onTagsChange(habit.id, newTagIds)
                                                    setSelectedTagIds(newTagIds)
                                                } else {
                                                    setSelectedTagIds([...selectedTagIds, tagId])
                                                }
                                            }}
                                            onDeselect={async (tagId) => {
                                                if (habit && onTagsChange) {
                                                    const newTagIds = selectedTagIds.filter(id => id !== tagId)
                                                    await onTagsChange(habit.id, newTagIds)
                                                    setSelectedTagIds(newTagIds)
                                                } else {
                                                    setSelectedTagIds(selectedTagIds.filter(id => id !== tagId))
                                                }
                                            }}
                                            label="Tags"
                                            placeholder="Search and add tags..."
                                            emptyMessage="No tags available"
                                        />
                                    </div>
                                )}
                                
                                {/* Related Habits - hidden in Normal View unless expanded */}
                                {viewMode === 'detail' ? (
                                <div className="mt-4">
                                    <h3 className="text-lg font-medium">Related Habits</h3>
                                    <div className="mt-2 space-y-2">
                                        {loadingRelations && <div className="text-xs text-zinc-500">Loading...</div>}
                                        {!loadingRelations && relations.length === 0 && <div className="text-xs text-zinc-500">No related habits.</div>}
                                        {relations.map((r) => {
                                            const other = allHabits.find(h => h.id === r.relatedHabitId) || { name: r.relatedHabitId }
                                            return (
                                                <div key={r.id} className="flex items-center justify-between rounded px-2 py-2 border">
                                                    <div className="text-sm"><span className="font-medium">{other.name}</span> <span className="text-xs text-zinc-500">({r.relation})</span></div>
                                                    <div>
                                                        <button type="button" onClick={() => handleDeleteRelation(r.id)} className="p-2 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Delete relation" title="Delete relation">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        <div className="flex gap-2 items-center">
                                            <select value={selectedRelatedHabitId} onChange={(e) => setSelectedRelatedHabitId(e.target.value)} className="rounded border px-2 py-1 bg-white text-black dark:bg-slate-800 dark:text-slate-100 flex-1">
                                                <option value="">Select habit...</option>
                                                {allHabits.filter(h => h.id !== habit?.id).map(h => (
                                                    <option key={h.id} value={h.id}>{h.name}</option>
                                                ))}
                                            </select>
                                            <select value={selectedRelationType} onChange={(e) => setSelectedRelationType(e.target.value as any)} className="rounded border px-2 py-1 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                <option value="main">Main</option>
                                                <option value="sub">Sub</option>
                                                <option value="next">Next</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={handleAddRelation}
                                                disabled={!habit}
                                                className="rounded bg-slate-100 p-2 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                aria-label="Add relation"
                                                title="Add relation"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                </svg>
                                            </button>
                                        </div>
                                        {!habit && <div className="text-xs text-zinc-500">Save the habit first to add relations.</div>}
                                    </div>
                                </div>
                                ) : (
                                <CollapsibleSection
                                    title="Related Habits"
                                    isExpanded={expandedSections.relatedHabits}
                                    onToggle={() => toggleSection('relatedHabits')}
                                >
                                    <div>
                                        <h3 className="text-lg font-medium">Related Habits</h3>
                                        <div className="mt-2 space-y-2">
                                            {loadingRelations && <div className="text-xs text-zinc-500">Loading...</div>}
                                            {!loadingRelations && relations.length === 0 && <div className="text-xs text-zinc-500">No related habits.</div>}
                                            {relations.map((r) => {
                                                const other = allHabits.find(h => h.id === r.relatedHabitId) || { name: r.relatedHabitId }
                                                return (
                                                    <div key={r.id} className="flex items-center justify-between rounded px-2 py-2 border">
                                                        <div className="text-sm"><span className="font-medium">{other.name}</span> <span className="text-xs text-zinc-500">({r.relation})</span></div>
                                                        <div>
                                                            <button type="button" onClick={() => handleDeleteRelation(r.id)} className="p-2 text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Delete relation" title="Delete relation">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M6 2a1 1 0 011-1h6a1 1 0 011 1v1h3a1 1 0 110 2h-1v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5H3a1 1 0 110-2h3V2zm2 5a1 1 0 10-2 0v7a1 1 0 102 0V7zm4 0a1 1 0 10-2 0v7a1 1 0 102 0V7z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            <div className="flex gap-2 items-center">
                                                <select value={selectedRelatedHabitId} onChange={(e) => setSelectedRelatedHabitId(e.target.value)} className="rounded border px-2 py-1 bg-white text-black dark:bg-slate-800 dark:text-slate-100 flex-1">
                                                    <option value="">Select habit...</option>
                                                    {allHabits.filter(h => h.id !== habit?.id).map(h => (
                                                        <option key={h.id} value={h.id}>{h.name}</option>
                                                    ))}
                                                </select>
                                                <select value={selectedRelationType} onChange={(e) => setSelectedRelationType(e.target.value as any)} className="rounded border px-2 py-1 bg-white text-black dark:bg-slate-800 dark:text-slate-100">
                                                    <option value="main">Main</option>
                                                    <option value="sub">Sub</option>
                                                    <option value="next">Next</option>
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={handleAddRelation}
                                                    disabled={!habit}
                                                    className="rounded bg-slate-100 p-2 disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                                    aria-label="Add relation"
                                                    title="Add relation"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                    </svg>
                                                </button>
                                            </div>
                                            {!habit && <div className="text-xs text-zinc-500">Save the habit first to add relations.</div>}
                                        </div>
                                    </div>
                                </CollapsibleSection>
                                )}
                        </div>
                    </div>

                </div>

                {/* 固定フッター */}
                <StickyFooter
                    onSave={handleSave}
                    onCancel={onClose}
                    onDelete={habit ? handleDelete : undefined}
                    saveDisabled={!name.trim()}
                    saveLabel={t('habit.button.save')}
                    cancelLabel={t('habit.button.cancel')}
                    deleteLabel={t('habit.button.delete')}
                    deleteConfirmMessage="Are you sure you want to delete this habit?"
                />
            </div>
        </div>
    )
}
