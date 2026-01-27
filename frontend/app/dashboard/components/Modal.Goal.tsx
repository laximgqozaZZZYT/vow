"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import SmartSelector, { SmartSelectorItem } from './Widget.SmartSelector'
import StickyFooter from './Widget.StickyFooter'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { useSubscription } from '../../../hooks/useSubscription'
import { supabase } from '../../../lib/supabaseClient'
import LevelAssessmentSliders, { type LevelVariables } from './Widget.LevelAssessmentSliders'

/**
 * GoalModal - Goal編集モーダル
 * 
 * UI/UX改善:
 * - SmartSelectorによる検索式タグ選択
 * - StickyFooterによる固定フッター
 * - 主要項目を最上部に配置
 * 
 * @validates Requirements 1.1-1.4, 2.4, 4.1-4.4
 */

// Backend API endpoint
const API_URL = process.env.NEXT_PUBLIC_SLACK_API_URL || ''

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

// Habit suggestion from AI
interface HabitSuggestion {
    name: string
    type: 'do' | 'avoid'
    frequency: 'daily' | 'weekly' | 'monthly'
    suggestedTargetCount: number
    workloadUnit: string | null
    reason: string
    confidence: number
}

// 折りたたみセクションコンポーネント
function CollapsibleSection({ 
    title, 
    isExpanded, 
    onToggle, 
    children,
    badge
}: { 
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    badge?: string;
}) {
    const sectionId = `section-${title.toLowerCase().replace(/\s+/g, '-')}`;
    
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                onClick={onToggle}
                className="
                    flex items-center justify-between w-full
                    px-4 py-3 text-left
                    bg-muted/30 hover:bg-muted/50
                    transition-colors
                    min-h-[44px]
                "
                aria-expanded={isExpanded}
                aria-controls={sectionId}
            >
                <div className="flex items-center gap-2">
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-medium text-sm">{title}</span>
                </div>
                {badge && (
                    <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                        {badge}
                    </span>
                )}
            </button>
            {isExpanded && (
                <div id={sectionId} className="p-4 border-t border-border animate-fadeIn">
                    {children}
                </div>
            )}
        </div>
    );
}

export function GoalModal({ open, onClose, goal, onUpdate, onDelete, onCreate, onComplete, goals, tags, onTagsChange, initial, onCreateHabit, habits }: { open: boolean; onClose: () => void; goal: Goal | null; onUpdate?: (g: Goal) => void; onDelete?: (id: string) => void; onCreate?: (payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => void; onComplete?: (goalId: string) => void; goals?: Goal[]; tags?: any[]; onTagsChange?: (goalId: string, tagIds: string[]) => Promise<void>; initial?: { name?: string; parentId?: string | null }; onCreateHabit?: (habit: { name: string; goalId: string; frequency: string; targetCount: number; workloadUnit?: string }) => void; habits?: { id: string; goalId: string; level?: number | null }[] }) {
    const [name, setName] = useState(goal?.name ?? "")
    const [details, setDetails] = useState(goal?.details ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
    const [parentId, setParentId] = useState<string | null>(goal?.parentId ?? null)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const [isLoading, setIsLoading] = useState(false)
    
    // Calculate goal level from child habits (MAX of child habit levels)
    const goalLevel = useMemo(() => {
        if (!goal || !habits) return null
        const childHabits = habits.filter(h => h.goalId === goal.id && h.level !== null && h.level !== undefined)
        if (childHabits.length === 0) return null
        return Math.max(...childHabits.map(h => h.level as number))
    }, [goal, habits])
    
    // 折りたたみセクションの状態
    const [showAISuggestions, setShowAISuggestions] = useState(false)
    
    // Habit suggestion state
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState<HabitSuggestion[]>([])
    const [suggestionsLoading, setSuggestionsLoading] = useState(false)
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null)
    
    const { isPremium, currentPlan } = useSubscription()

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
            // Reset suggestion state
            setShowSuggestions(false)
            setSuggestions([])
            setSuggestionsError(null)
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

    // SmartSelector用のタグアイテム変換
    const tagItems: SmartSelectorItem[] = useMemo(() => 
        (tags || []).map((tag: any) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color
        })),
        [tags]
    );

    // タグ選択ハンドラ
    const handleTagSelect = useCallback(async (tagId: string) => {
        const newTagIds = [...selectedTagIds, tagId]
        setSelectedTagIds(newTagIds)
        if (goal && onTagsChange) {
            await onTagsChange(goal.id, newTagIds)
        }
    }, [selectedTagIds, goal, onTagsChange]);

    const handleTagDeselect = useCallback(async (tagId: string) => {
        const newTagIds = selectedTagIds.filter(id => id !== tagId)
        setSelectedTagIds(newTagIds)
        if (goal && onTagsChange) {
            await onTagsChange(goal.id, newTagIds)
        }
    }, [selectedTagIds, goal, onTagsChange]);

    // Fetch habit suggestions from AI
    async function fetchHabitSuggestions() {
        if (!goal) return
        
        setSuggestionsLoading(true)
        setSuggestionsError(null)
        
        try {
            if (!supabase) {
                throw new Error('Supabase client not initialized')
            }
            const { data: { session } } = await supabase.auth.getSession()
            if (!session?.access_token) {
                throw new Error('Not authenticated')
            }
            
            const response = await fetch(`${API_URL}/api/ai/suggest-habits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ goalId: goal.id }),
            })
            
            if (!response.ok) {
                const data = await response.json()
                if (response.status === 402) {
                    setSuggestionsError('この機能はPremiumプランでのみ利用可能です')
                } else if (response.status === 429) {
                    setSuggestionsError('今月のトークン上限に達しました')
                } else {
                    setSuggestionsError(data.message || 'AI処理中にエラーが発生しました')
                }
                return
            }
            
            const data = await response.json()
            setSuggestions(data.suggestions || [])
            setShowSuggestions(true)
        } catch (err) {
            console.error('[GoalModal] fetchHabitSuggestions error', err)
            setSuggestionsError(err instanceof Error ? err.message : 'エラーが発生しました')
        } finally {
            setSuggestionsLoading(false)
        }
    }

    // Handle selecting a suggestion
    function handleSelectSuggestion(suggestion: HabitSuggestion) {
        if (!goal || !onCreateHabit) return
        
        onCreateHabit({
            name: suggestion.name,
            goalId: goal.id,
            frequency: suggestion.frequency,
            targetCount: suggestion.suggestedTargetCount,
            workloadUnit: suggestion.workloadUnit || undefined,
        })
        
        // Remove the selected suggestion from the list
        setSuggestions(suggestions.filter(s => s.name !== suggestion.name))
    }

    if (!open) return null

    function handleSave() {
        setIsLoading(true)
        try {
            if (goal) {
                const updated: Goal = { ...goal, name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId }
                onUpdate && onUpdate(updated)
            } else {
                const payload = { name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId: parentId || null }
                onCreate && onCreate(payload)
            }
            onClose()
        } finally {
            setIsLoading(false)
        }
    }

    function handleDelete() {
        if (!goal) return
        onDelete && onDelete(goal.id)
    }

    function handleComplete() {
        if (!goal) return
        onComplete && onComplete(goal.id)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-[10001] flex items-start justify-center pt-4 sm:pt-12 bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg text-card-foreground flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                {/* ヘッダー */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="text-lg font-semibold">{goal ? 'Edit Goal' : 'New Goal'}</h3>
                    <button 
                        onClick={onClose} 
                        className="text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* スクロール可能なコンテンツ */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <style>{`
                        @keyframes fadeIn {
                            from { opacity: 0; transform: translateY(-10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                        .animate-fadeIn {
                            animation: fadeIn 0.2s ease-in-out;
                        }
                    `}</style>

                    <div className="space-y-4">
                        {/* Name - 主要項目 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Name</label>
                            <input 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50" 
                                placeholder="Goal name" 
                            />
                        </div>

                        {/* Level display - only show for existing goals */}
                        {goal && (
                            <div>
                                <label className="block text-sm font-medium mb-1">Level</label>
                                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border">
                                    <span className="text-sm font-medium text-foreground">
                                        {goalLevel !== null ? `Lv. ${goalLevel}` : 'Lv. ???'}
                                    </span>
                                    {goalLevel !== null && (
                                        <span className="text-xs text-muted-foreground">
                                            ({goalLevel < 50 ? '初級' : goalLevel < 100 ? '中級' : goalLevel < 150 ? '上級' : '達人'})
                                        </span>
                                    )}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        子Habitの最大値
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Details - 主要項目 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Details</label>
                            <textarea 
                                value={details} 
                                onChange={(e) => setDetails(e.target.value)} 
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none" 
                                placeholder="Optional details" 
                            />
                        </div>

                        {/* Due date と Parent goal を2カラムで表示 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Due date */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Due date</label>
                                <Popover className="relative">
                                    <Popover.Button className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                        {dueDate ? dueDate.toDateString() : "Select date"}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </Popover.Button>
                                    <Popover.Panel className="absolute z-[10002] mt-2 left-0 w-[min(320px,90vw)]">
                                        <div className="rounded-lg border border-border bg-card p-4 shadow-lg max-w-full">
                                            <DayPicker mode="single" selected={dueDate} onSelect={(d) => setDueDate(d ?? undefined)} />
                                        </div>
                                    </Popover.Panel>
                                </Popover>
                            </div>

                            {/* Parent goal */}
                            <div>
                                <label className="block text-sm font-medium mb-1">Parent goal</label>
                                <select 
                                    value={parentId ?? ''} 
                                    onChange={(e) => setParentId(e.target.value || null)} 
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    <option value="">(no parent)</option>
                                    {goals?.filter(g => !goal || g.id !== goal.id).map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Tags - SmartSelector */}
                        {tags && tags.length > 0 && (
                            <SmartSelector
                                items={tagItems}
                                selectedIds={selectedTagIds}
                                onSelect={handleTagSelect}
                                onDeselect={handleTagDeselect}
                                label="Tags"
                                placeholder="Search and add tags..."
                                emptyMessage="No tags available"
                            />
                        )}

                        {/* AI Habit Suggestions (Premium feature) - 折りたたみセクション */}
                        {goal && (
                            <CollapsibleSection
                                title="AI Habit提案"
                                isExpanded={showAISuggestions}
                                onToggle={() => setShowAISuggestions(!showAISuggestions)}
                                badge={currentPlan === 'premium_pro' ? 'Premium Pro' : 'Premium Pro限定'}
                            >
                                {!showSuggestions ? (
                                    <button
                                        onClick={fetchHabitSuggestions}
                                        disabled={suggestionsLoading || currentPlan !== 'premium_pro'}
                                        className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                                    >
                                        {suggestionsLoading ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                提案を生成中...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                </svg>
                                                このGoalに合うHabitを提案
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        {suggestions.length > 0 ? (
                                            suggestions.map((suggestion, index) => (
                                                <div key={index} className="p-3 rounded-md border border-border bg-muted/50">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="font-medium text-sm">{suggestion.name}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                {suggestion.frequency === 'daily' ? '毎日' : suggestion.frequency === 'weekly' ? '毎週' : '毎月'}
                                                                {suggestion.suggestedTargetCount > 1 && ` ${suggestion.suggestedTargetCount}${suggestion.workloadUnit || '回'}`}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground mt-1">{suggestion.reason}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleSelectSuggestion(suggestion)}
                                                            disabled={!onCreateHabit}
                                                            className="ml-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 min-h-[32px]"
                                                        >
                                                            追加
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-2">
                                                すべての提案を追加しました
                                            </p>
                                        )}
                                        <button
                                            onClick={() => setShowSuggestions(false)}
                                            className="w-full text-xs text-muted-foreground hover:text-foreground min-h-[32px]"
                                        >
                                            閉じる
                                        </button>
                                    </div>
                                )}
                                
                                {suggestionsError && (
                                    <p className="text-xs text-destructive mt-2">{suggestionsError}</p>
                                )}
                            </CollapsibleSection>
                        )}
                    </div>
                </div>

                {/* 固定フッター */}
                <StickyFooter
                    onSave={handleSave}
                    onCancel={onClose}
                    onDelete={goal ? handleDelete : undefined}
                    onComplete={goal ? handleComplete : undefined}
                    isLoading={isLoading}
                    saveDisabled={!name.trim()}
                    deleteConfirmMessage="Are you sure you want to delete this goal?"
                    deleteLabel="Delete goal"
                />
            </div>
        </div>
    )
}
