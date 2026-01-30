"use client"

/**
 * HabitModal Component
 * 
 * Modal dialog for creating and editing habits.
 * Uses a 4-tab structure for organizing habit settings:
 * - 基本 (Basic): Name, Type, Timings, Description
 * - 除外日時 (Exclusion): Outdates configuration
 * - 負荷 (Workload): Level, Workload settings
 * - 詳細 (Detail): Goal, Tags, Related Habits
 * 
 * Requirements implemented:
 * - 10.1: Remove Normal_View and Detail_View toggle
 * - 10.2: Remove CollapsibleSection components
 * - 10.3: Migrate all fields into appropriate tabs
 * - 10.4: Remove viewMode localStorage persistence
 * 
 * @module Modal.Habit
 */

import React from "react"
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { supabase } from '../../../lib/supabaseClient'
import { debug } from '../../../lib/debug'
import StickyFooter from './Widget.StickyFooter'
import { useLocale } from '@/contexts/LocaleContext'
import { type LevelVariables } from './Widget.LevelAssessmentSliders'

// Tab components and navigation
import { TabNavigation, HABIT_MODAL_TABS } from './TabNavigation'
import { useHabitModalTabs } from '../hooks/useHabitModalTabs'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { 
  BasicTab, 
  ExclusionTab, 
  WorkloadTab, 
  DetailTab,
  type Timing,
  type TimingType,
  type Habit,
  type HabitFormState,
  type HabitRelation,
} from './tabs'

// ============================================================================
// Types
// ============================================================================

type CreateHabitPayload = { 
  name: string
  goalId?: string
  type: "do" | "avoid"
  duration?: number
  reminders?: any[]
  dueDate?: string
  time?: string
  endTime?: string
  repeat?: string
  timings?: any[]
  allDay?: boolean
  notes?: string
  workloadUnit?: string
  workloadTotal?: number
  workloadTotalEnd?: number
  workloadPerCount?: number
  relatedHabitIds?: string[]
}

interface HabitModalProps {
  open: boolean
  onClose: () => void
  habit: Habit | null
  onUpdate?: (h: Habit) => void
  onDelete?: (id: string) => void
  onCreate?: (payload: CreateHabitPayload) => void
  initial?: { 
    name?: string
    date?: string
    time?: string
    endTime?: string
    type?: "do" | "avoid"
    goalId?: string
    relatedHabitIds?: string[]
  }
  categories?: { id: string; name: string }[]
  tags?: any[]
  onTagsChange?: (habitId: string, tagIds: string[]) => Promise<void>
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function minutesFromHHMM(s?: string): number | null {
  if (!s) return null
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

// ============================================================================
// Component
// ============================================================================

export function HabitModal({ 
  open, 
  onClose, 
  habit, 
  onUpdate, 
  onDelete, 
  onCreate, 
  initial, 
  categories: goals, 
  tags, 
  onTagsChange 
}: HabitModalProps) {
  const { t } = useLocale()
  
  const { 
    activeTab, 
    setActiveTab, 
    goToNextTab, 
    goToPreviousTab, 
    isFirstTab, 
    isLastTab 
  } = useHabitModalTabs()

  const { handlers: swipeHandlers, offset: swipeOffset, isDragging } = useSwipeGesture({
    onSwipeLeft: goToNextTab,
    onSwipeRight: goToPreviousTab,
    disableSwipeLeft: isLastTab,
    disableSwipeRight: isFirstTab,
  })

  const [name, setName] = React.useState<string>(habit?.name ?? "")
  const [notes, setNotes] = React.useState<string>(habit?.notes ?? "")
  const [type, setType] = React.useState<"do" | "avoid">(habit?.type ?? "do")
  const [goalId, setGoalId] = React.useState<string | undefined>(habit?.goalId)
  const [workloadUnit, setWorkloadUnit] = React.useState<string>('')
  const [workloadTotal, setWorkloadTotal] = React.useState<string>('')
  const [workloadTotalEnd, setWorkloadTotalEnd] = React.useState<string>('')
  const [workloadPerCount, setWorkloadPerCount] = React.useState<string>('1')
  const [timings, setTimings] = React.useState<Timing[]>([])
  const [outdates, setOutdates] = React.useState<Timing[]>([])
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([])
  const [allHabits, setAllHabits] = React.useState<Habit[]>([])
  const [relations, setRelations] = React.useState<HabitRelation[]>([])
  const [loadingRelations, setLoadingRelations] = React.useState(false)
  
  // Track validation errors per tab for error indicators (Requirement 8.4)
  const [tabErrors, setTabErrors] = React.useState<Record<string, boolean>>({
    basic: false,
    exclusion: false,
    workload: false,
    detail: false,
  })

  const timingDurations = React.useMemo(() => {
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

  const totalTimingMinutes = React.useMemo(
    () => timingDurations.reduce((a, b) => a + b, 0), 
    [timingDurations]
  )

  const autoLoadPerSetByTiming = React.useMemo(() => {
    const dayTotalNum = Number(workloadTotal)
    const dayTotal = !isNaN(dayTotalNum) && dayTotalNum > 0 ? dayTotalNum : null
    if (dayTotal === null || dayTotal <= 0) return (timings ?? []).map(() => null as number | null)
    if (!timingDurations.length) return (timings ?? []).map(() => null as number | null)
    const denom = totalTimingMinutes > 0 ? totalTimingMinutes : timingDurations.length
    return timingDurations.map((d) => {
      const w = totalTimingMinutes > 0 ? d : 1
      const v = dayTotal * (w / denom)
      return Number.isFinite(v) ? v : null
    })
  }, [timings, timingDurations, totalTimingMinutes, workloadTotal])

  const formState: HabitFormState = React.useMemo(() => ({
    name, type, timings, notes, outdates, workloadUnit, workloadTotal, 
    workloadTotalEnd, workloadPerCount, goalId, selectedTagIds,
  }), [name, type, timings, notes, outdates, workloadUnit, workloadTotal, workloadTotalEnd, workloadPerCount, goalId, selectedTagIds])

  async function loadAllHabits() {
    try {
      const h = await supabaseDirectClient.getHabits()
      setAllHabits(Array.isArray(h) ? h : [])
    } catch (err) {
      console.error('[HabitModal] loadAllHabits error', err)
    }
  }

  async function loadRelations() {
    if (!habit) { setRelations([]); return }
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

  async function loadHabitTags(habitId: string) {
    try {
      const habitTags = await supabaseDirectClient.getHabitTags(habitId)
      setSelectedTagIds(habitTags.map((t: any) => t.id))
    } catch (err) {
      console.error('[HabitModal] loadHabitTags error', err)
    }
  }

  React.useEffect(() => {
    if (!open) return
    loadAllHabits()
    loadRelations()
  }, [open, habit?.id])

  React.useEffect(() => {
    if (!open) return
    // Reset tab errors when modal opens
    setTabErrors({ basic: false, exclusion: false, workload: false, detail: false })
    if (habit) {
      setWorkloadUnit((habit as any)?.workloadUnit ?? '')
      setWorkloadTotal(String((habit as any)?.workloadTotal ?? (habit as any)?.targetCount ?? (habit as any)?.must ?? ''))
      setWorkloadTotalEnd(String((habit as any)?.workloadTotalEnd ?? ''))
      setWorkloadPerCount(String((habit as any)?.workloadPerCount ?? 1))
      setName(habit?.name ?? '')
      setNotes(habit?.notes ?? '')
      setType(habit?.type ?? 'do')
      setGoalId(habit?.goalId)
      setTimings(((habit as any)?.timings ?? []).map((x: any) => ({ ...x })))
      const incomingOutdates = ((habit as any)?.outdates ?? []).map((x: any) => ({ ...x }))
      setOutdates(incomingOutdates.length ? incomingOutdates : [])
      if (!((habit as any)?.timings ?? []).length) {
        const tType: TimingType = habit?.dueDate ? 'Date' : 'Daily'
        setTimings([{ type: tType, date: habit?.dueDate ? (typeof habit.dueDate === 'string' ? habit.dueDate : formatLocalDate(new Date(habit.dueDate))) : undefined, start: habit?.time ?? undefined, end: habit?.endTime ?? undefined }])
      }
      loadHabitTags(habit.id)
    } else {
      setWorkloadUnit('')
      setWorkloadTotal('')
      setWorkloadTotalEnd('')
      setWorkloadPerCount('1')
      setName(initial?.name ?? '')
      setNotes('')
      setType(initial?.type ?? 'do')
      setGoalId(initial?.goalId)
      const tType: TimingType = initial?.date ? 'Date' : 'Daily'
      setTimings([{ type: tType, date: initial?.date ?? undefined, start: initial?.time ?? undefined, end: initial?.endTime ?? undefined }])
      setOutdates([])
      setSelectedTagIds([])
      if (initial?.relatedHabitIds && initial.relatedHabitIds.length > 0) {
        const initialRelations: HabitRelation[] = initial.relatedHabitIds.map(relatedHabitId => ({
          id: `temp-${Date.now()}-${relatedHabitId}`, habitId: '', relatedHabitId, relation: 'next' as const,
        }))
        setRelations(initialRelations)
      } else {
        setRelations([])
      }
    }
  }, [habit, initial, open])

  const handleFieldChange = React.useCallback((field: string, value: any) => {
    switch (field) {
      case 'name': setName(value); break
      case 'type': setType(value); break
      case 'timings': setTimings(value); break
      case 'notes': setNotes(value); break
      case 'outdates': setOutdates(value); break
      case 'workloadUnit': setWorkloadUnit(value); break
      case 'workloadTotal': setWorkloadTotal(value); break
      case 'workloadTotalEnd': setWorkloadTotalEnd(value); break
      case 'workloadPerCount': setWorkloadPerCount(value); break
      case 'goalId': setGoalId(value); break
      case 'selectedTagIds': setSelectedTagIds(value); break
    }
  }, [])

  const handleLevelAssessment = React.useCallback(async (habitId: string, variables: LevelVariables, level: number) => {
    try {
      if (!supabase) { alert('Supabaseが初期化されていません'); return }
      const { data: { session } } = await supabase.auth.getSession()
      const now = new Date().toISOString()
      const levelTier = level < 50 ? 'beginner' : level < 100 ? 'intermediate' : level < 150 ? 'advanced' : 'expert'
      if (!session?.user) {
        const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]')
        const habitIndex = guestHabits.findIndex((h: any) => h.id === habitId)
        if (habitIndex === -1) { alert('習慣が見つかりません'); return }
        guestHabits[habitIndex] = { ...guestHabits[habitIndex], level, levelTier, levelAssessedAt: now, levelAssessmentRaw: { assessmentType: 'manual_slider', variables, level, assessedAt: now }, updatedAt: now }
        localStorage.setItem('guest-habits', JSON.stringify(guestHabits))
        onClose()
        return
      }
      const { error } = await supabase.from('habits').update({ level, level_tier: levelTier, level_assessed_at: now, level_assessment_raw: { assessmentType: 'manual_slider', variables, level, assessedAt: now }, updated_at: now }).eq('id', habitId).eq('owner_id', session.user.id).select()
      if (error) { alert(`レベルの保存に失敗しました: ${error.message}`); return }
      try { await supabase.from('level_history').insert({ habit_id: habitId, user_id: session.user.id, old_level: (habit as any)?.level ?? null, new_level: level, change_reason: 'manual_adjustment', workload_delta: variables }) } catch {}
      onClose()
    } catch (err) { alert(`エラーが発生しました: ${err instanceof Error ? err.message : String(err)}`) }
  }, [habit, onClose])

  const handleAddRelation = React.useCallback(async (relation: Omit<HabitRelation, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!habit) return
    try {
      await supabaseDirectClient.createHabitRelation({ habitId: habit.id, relatedHabitId: relation.relatedHabitId, relation: relation.relation })
      await loadRelations()
    } catch (err) { console.error('[HabitModal] create relation error', err) }
  }, [habit])

  const handleDeleteRelation = React.useCallback(async (id: string) => {
    try { await supabaseDirectClient.deleteHabitRelation(id); await loadRelations() } catch (err) { console.error('[HabitModal] delete relation error', err) }
  }, [])

  const handleTagsChange = React.useCallback(async (tagIds: string[]) => {
    if (habit && onTagsChange) { await onTagsChange(habit.id, tagIds) }
    setSelectedTagIds(tagIds)
  }, [habit, onTagsChange])

  /**
   * Validate form data and return errors per tab
   * Returns an object with tab IDs as keys and boolean error status as values
   * Requirement 8.4: Indicate which tab contains errors
   */
  const validateFormData = React.useCallback((): { isValid: boolean; errors: Record<string, boolean> } => {
    const errors: Record<string, boolean> = {
      basic: false,
      exclusion: false,
      workload: false,
      detail: false,
    }

    // Basic Tab validation: name is required
    if (!name.trim()) {
      errors.basic = true
    }

    // Basic Tab validation: check for invalid timing configuration
    const hasInvalidTimings = timings.some(timing => {
      // If timing has start time, it should be valid format
      if (timing.start && !/^\d{1,2}:\d{2}$/.test(timing.start)) {
        return true
      }
      // If timing has end time, it should be valid format
      if (timing.end && !/^\d{1,2}:\d{2}$/.test(timing.end)) {
        return true
      }
      // If both start and end are provided, end should be after start
      if (timing.start && timing.end) {
        const startMinutes = minutesFromHHMM(timing.start)
        const endMinutes = minutesFromHHMM(timing.end)
        if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
          return true
        }
      }
      return false
    })
    if (hasInvalidTimings) {
      errors.basic = true
    }

    // Workload Tab validation: check for invalid workload values
    if (workloadTotal && (isNaN(Number(workloadTotal)) || Number(workloadTotal) < 0)) {
      errors.workload = true
    }
    if (workloadTotalEnd && (isNaN(Number(workloadTotalEnd)) || Number(workloadTotalEnd) < 0)) {
      errors.workload = true
    }
    if (workloadPerCount && (isNaN(Number(workloadPerCount)) || Number(workloadPerCount) <= 0)) {
      errors.workload = true
    }

    const isValid = !Object.values(errors).some(hasError => hasError)
    return { isValid, errors }
  }, [name, timings, workloadTotal, workloadTotalEnd, workloadPerCount])

  /**
   * Clear tab errors when user starts editing
   * This provides immediate feedback that the error has been addressed
   */
  const clearTabError = React.useCallback((tabId: string) => {
    setTabErrors(prev => ({ ...prev, [tabId]: false }))
  }, [])

  // Clear basic tab error when name changes
  React.useEffect(() => {
    if (name.trim()) {
      clearTabError('basic')
    }
  }, [name, clearTabError])

  // Clear workload tab error when workload values change
  React.useEffect(() => {
    const workloadTotalValid = !workloadTotal || (!isNaN(Number(workloadTotal)) && Number(workloadTotal) >= 0)
    const workloadTotalEndValid = !workloadTotalEnd || (!isNaN(Number(workloadTotalEnd)) && Number(workloadTotalEnd) >= 0)
    const workloadPerCountValid = !workloadPerCount || (!isNaN(Number(workloadPerCount)) && Number(workloadPerCount) > 0)
    
    if (workloadTotalValid && workloadTotalEndValid && workloadPerCountValid) {
      clearTabError('workload')
    }
  }, [workloadTotal, workloadTotalEnd, workloadPerCount, clearTabError])

  function handleSave() {
    debug.log('[HabitModal] handleSave called')
    
    // Validate form data and update tab error indicators (Requirement 8.4)
    const { isValid, errors } = validateFormData()
    setTabErrors(errors)
    
    // If validation fails, navigate to the first tab with errors
    if (!isValid) {
      const tabOrder = ['basic', 'exclusion', 'workload', 'detail']
      const firstErrorTab = tabOrder.findIndex(tabId => errors[tabId])
      if (firstErrorTab !== -1) {
        setActiveTab(firstErrorTab)
      }
      return
    }
    
    if (habit) {
      const updated: Habit = { ...habit, id: habit.id, goalId: goalId ?? habit.goalId, name: name.trim() || "Untitled", notes: notes.trim() || undefined, type, ...(workloadUnit ? { workloadUnit } as any : {}), ...(workloadTotal ? { workloadTotal: Number(workloadTotal) } as any : {}), ...(workloadTotalEnd ? { workloadTotalEnd: Number(workloadTotalEnd) } as any : {}), ...(Number(workloadPerCount) || 1 ? { workloadPerCount: Number(workloadPerCount) || 1 } as any : {}), timings: timings as any, outdates: outdates as any, updatedAt: new Date().toISOString() }
      const totalVal = (updated as any).workloadTotal ?? (updated as any).must ?? 0
      const currentCount = habit.count ?? 0
      ;(updated as any).completed = totalVal > 0 ? (currentCount >= totalVal) : ((updated as any).completed ?? false)
      onUpdate && onUpdate(updated)
      onClose()
    } else {
      let finalTimings = timings
      if (!finalTimings || finalTimings.length === 0) {
        const tType: TimingType = initial?.date ? 'Date' : 'Daily'
        finalTimings = [{ type: tType, date: initial?.date ?? undefined, start: initial?.time ?? undefined, end: initial?.endTime ?? undefined }]
      }
      const payload: CreateHabitPayload = { name: name.trim() || "Untitled", type, timings: finalTimings, workloadUnit: workloadUnit || undefined, workloadTotal: workloadTotal ? Number(workloadTotal) : undefined, workloadTotalEnd: workloadTotalEnd ? Number(workloadTotalEnd) : undefined, workloadPerCount: Number(workloadPerCount) || 1, notes: notes.trim() || undefined, relatedHabitIds: relations.length > 0 ? relations.map(r => r.relatedHabitId) : undefined }
      const resolvedGoalId = goalId ?? (goals && goals.length ? goals[0].id : undefined)
      if (resolvedGoalId) payload.goalId = resolvedGoalId
      onCreate && onCreate(payload)
      onClose()
    }
  }

  function handleDelete() { if (habit) onDelete && onDelete(habit.id); onClose() }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-12 bg-background/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-[720px] rounded-lg border border-border bg-card px-3 sm:px-4 pt-3 sm:pt-4 pb-0 shadow-lg text-card-foreground flex flex-col max-h-[98vh] sm:max-h-[95vh] md:max-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl sm:text-2xl font-semibold">{t('habit.title')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg sm:text-xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors" aria-label="Close modal">✕</button>
        </div>
        <TabNavigation tabs={HABIT_MODAL_TABS} activeTab={activeTab} onTabChange={setActiveTab} hasErrors={tabErrors} />
        <style>{`
          .habit-scroll-area { 
            scrollbar-width: thin; 
            scrollbar-color: rgba(148,163,184,.6) transparent; 
          } 
          .habit-scroll-area::-webkit-scrollbar { width: 10px; } 
          .habit-scroll-area::-webkit-scrollbar-track { background: transparent; } 
          .habit-scroll-area::-webkit-scrollbar-thumb { 
            background: rgba(148,163,184,.6); 
            border-radius: 9999px; 
            border: 2px solid transparent; 
            background-clip: padding-box; 
          } 
          .habit-scroll-area::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.85); }
          
          /* Reduced motion support for swipe gesture visual feedback (Requirement 12.4) */
          @media (prefers-reduced-motion: reduce) {
            .habit-tab-content {
              transition: none !important;
              transform: none !important;
            }
          }
        `}</style>
        <div 
          className="mt-4 habit-scroll-area habit-tab-content overflow-auto flex-1 pr-2" 
          {...swipeHandlers} 
          style={{ 
            transform: isDragging ? `translateX(${swipeOffset}px)` : undefined, 
            /* Smooth transition when releasing swipe gesture (Requirement 7.5, 12.4) */
            transition: isDragging ? 'none' : 'transform 0.2s ease-out' 
          }}
        >
          <BasicTab isActive={activeTab === 0} formState={formState} onFieldChange={handleFieldChange} habit={habit} onLevelAssessment={handleLevelAssessment} autoLoadPerSetByTiming={autoLoadPerSetByTiming} workloadUnit={workloadUnit} />
          <ExclusionTab isActive={activeTab === 1} outdates={outdates} onOutdatesChange={(newOutdates) => setOutdates(newOutdates)} />
          <WorkloadTab isActive={activeTab === 2} workloadUnit={workloadUnit} onWorkloadUnitChange={setWorkloadUnit} workloadPerCount={workloadPerCount} onWorkloadPerCountChange={setWorkloadPerCount} workloadTotal={workloadTotal} onWorkloadTotalChange={setWorkloadTotal} workloadTotalEnd={workloadTotalEnd} onWorkloadTotalEndChange={setWorkloadTotalEnd} timings={timings} autoLoadPerSet={autoLoadPerSetByTiming} habit={habit} onLevelAssessment={handleLevelAssessment} />
          <DetailTab isActive={activeTab === 3} formState={formState} onFieldChange={handleFieldChange} goals={goals ?? []} tags={(tags ?? []).map((tag: any) => ({ id: tag.id, name: tag.name, color: tag.color }))} allHabits={allHabits} relations={relations} onRelationAdd={handleAddRelation} onRelationDelete={handleDeleteRelation} onTagsChange={handleTagsChange} habit={habit} loadingRelations={loadingRelations} />
        </div>
        <StickyFooter onSave={handleSave} onCancel={onClose} onDelete={habit ? handleDelete : undefined} saveDisabled={!name.trim()} saveLabel={t('habit.button.save')} cancelLabel={t('habit.button.cancel')} deleteLabel={t('habit.button.delete')} deleteConfirmMessage="Are you sure you want to delete this habit?" />
      </div>
    </div>
  )
}
