"use client"

import React, { useState } from "react"
import { Popover } from "@headlessui/react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import TagSelector from './Widget.TagSelector'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { useSubscription } from '../../../hooks/useSubscription'
import { supabase } from '../../../lib/supabaseClient'

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

export function GoalModal({ open, onClose, goal, onUpdate, onDelete, onCreate, onComplete, goals, tags, onTagsChange, initial, onCreateHabit }: { open: boolean; onClose: () => void; goal: Goal | null; onUpdate?: (g: Goal) => void; onDelete?: (id: string) => void; onCreate?: (payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) => void; onComplete?: (goalId: string) => void; goals?: Goal[]; tags?: any[]; onTagsChange?: (goalId: string, tagIds: string[]) => Promise<void>; initial?: { name?: string; parentId?: string | null }; onCreateHabit?: (habit: { name: string; goalId: string; frequency: string; targetCount: number; workloadUnit?: string }) => void }) {
    const [name, setName] = useState(goal?.name ?? "")
    const [details, setDetails] = useState(goal?.details ?? "")
    const [dueDate, setDueDate] = useState<Date | undefined>(goal?.dueDate ? (typeof goal.dueDate === 'string' ? parseYMD(goal.dueDate) : (goal.dueDate as Date)) : undefined)
    const [parentId, setParentId] = useState<string | null>(goal?.parentId ?? null)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    
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
        if (goal) {
            const updated: Goal = { ...goal, name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId }
            onUpdate && onUpdate(updated)
            onClose()
        } else {
            const payload = { name: name.trim() || 'Untitled', details: details.trim() || undefined, dueDate: dueDate ? formatLocalDate(dueDate) : undefined, parentId: parentId || null }
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
                            {goals?.filter(g => !goal || g.id !== goal.id).map(g => (
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

                    {/* AI Habit Suggestions (Premium feature) */}
                    {goal && (
                        <div className="border-t border-border pt-4 mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium">AI Habit提案</label>
                                {currentPlan === 'premium_pro' ? (
                                    <span className="text-xs text-muted-foreground">Premium Pro</span>
                                ) : (
                                    <span className="text-xs text-warning">Premium Pro限定</span>
                                )}
                            </div>
                            
                            {!showSuggestions ? (
                                <button
                                    onClick={fetchHabitSuggestions}
                                    disabled={suggestionsLoading || currentPlan !== 'premium_pro'}
                                    className="w-full inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
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
                                                        className="ml-2 inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
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
                                        className="w-full text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        閉じる
                                    </button>
                                </div>
                            )}
                            
                            {suggestionsError && (
                                <p className="text-xs text-destructive mt-2">{suggestionsError}</p>
                            )}
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
