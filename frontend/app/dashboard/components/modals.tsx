"use client"

// This module re-exports individual modal components. The New Habit popup was removed.
export { HabitModal } from "./habitModal"
// NewGoalModal has been merged into GoalModal; use GoalModal for both create and edit flows
export { GoalModal } from "./goalModal"
