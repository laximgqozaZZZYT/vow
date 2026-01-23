/**
 * Habit Repository
 *
 * Database operations for habits table using the repository pattern.
 *
 * Requirements: 3.4
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base';
import type { Habit } from '../schemas/habit';
/**
 * Repository for habit database operations.
 *
 * This repository encapsulates all database operations for the habits table,
 * providing methods for querying habits by owner, name, and status.
 */
export declare class HabitRepository extends BaseRepository<Habit> {
    /**
     * Initialize the HabitRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase: SupabaseClient);
    /**
     * Get active habits with type='do' for an owner.
     *
     * Retrieves all habits that are active and have type 'do' (as opposed to 'avoid')
     * for the specified owner. This is commonly used for daily progress tracking
     * and habit completion workflows.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @returns List of habit objects matching the criteria. Returns an empty list if no habits are found.
     */
    getActiveDoHabits(ownerType: string, ownerId: string): Promise<Habit[]>;
    /**
     * Find habit by exact name match (case-insensitive).
     *
     * Searches for a habit with the exact name for the specified owner.
     * The search is case-insensitive using ILIKE.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param name - The exact name of the habit to find.
     * @returns The habit object if found, null otherwise.
     */
    findByName(ownerType: string, ownerId: string, name: string): Promise<Habit | null>;
    /**
     * Search habits by partial name match for suggestions.
     *
     * Performs a partial match search on habit names using ILIKE with wildcards.
     * This is useful for autocomplete/suggestion features in the UI.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param query - The search query string to match against habit names.
     * @param limit - Maximum number of results to return. Defaults to 5.
     * @returns List of habit objects matching the search query. Returns an empty list if no habits match.
     */
    searchByName(ownerType: string, ownerId: string, query: string, limit?: number): Promise<Habit[]>;
    /**
     * Get all habits for an owner.
     *
     * Retrieves all habits belonging to the specified owner, optionally
     * filtering to only active habits.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param activeOnly - If true, only return active habits. Defaults to false.
     * @returns List of habit objects for the owner. Returns an empty list if no habits are found.
     */
    getByOwner(ownerType: string, ownerId: string, activeOnly?: boolean): Promise<Habit[]>;
    /**
     * Get all habits associated with a specific goal.
     *
     * @param goalId - The unique identifier of the goal.
     * @param activeOnly - If true, only return active habits. Defaults to true.
     * @returns List of habit objects associated with the goal. Returns an empty list if no habits are found.
     */
    getHabitsByGoal(goalId: string, activeOnly?: boolean): Promise<Habit[]>;
    /**
     * Get all active habits with trigger_time set.
     *
     * Retrieves all habits that are active and have a trigger_time configured.
     * This is used by the FollowUpAgent to determine which habits need
     * reminders and follow-ups.
     *
     * @returns List of habit objects with trigger_time set. Returns an empty list if no habits are found.
     */
    getHabitsWithTriggers(): Promise<Habit[]>;
}
//# sourceMappingURL=habitRepository.d.ts.map