/**
 * Habit Repository
 *
 * Database operations for habits table using the repository pattern.
 *
 * Requirements: 3.4
 */
import { BaseRepository } from './base.js';
/**
 * Repository for habit database operations.
 *
 * This repository encapsulates all database operations for the habits table,
 * providing methods for querying habits by owner, name, and status.
 */
export class HabitRepository extends BaseRepository {
    /**
     * Initialize the HabitRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase) {
        super(supabase, 'habits');
    }
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
    async getActiveDoHabits(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('active', true)
            .eq('type', 'do');
        if (error || !data) {
            return [];
        }
        return data;
    }
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
    async findByName(ownerType, ownerId, name) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .ilike('name', name);
        if (error || !data || data.length === 0) {
            return null;
        }
        return data[0];
    }
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
    async searchByName(ownerType, ownerId, query, limit = 5) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .ilike('name', `%${query}%`)
            .limit(limit);
        if (error || !data) {
            return [];
        }
        return data;
    }
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
    async getByOwner(ownerType, ownerId, activeOnly = false) {
        let query = this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId);
        if (activeOnly) {
            query = query.eq('active', true);
        }
        const { data, error } = await query;
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Get all habits associated with a specific goal.
     *
     * @param goalId - The unique identifier of the goal.
     * @param activeOnly - If true, only return active habits. Defaults to true.
     * @returns List of habit objects associated with the goal. Returns an empty list if no habits are found.
     */
    async getHabitsByGoal(goalId, activeOnly = true) {
        let query = this.supabase
            .from(this.tableName)
            .select('*')
            .eq('goal_id', goalId);
        if (activeOnly) {
            query = query.eq('active', true);
        }
        const { data, error } = await query;
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Get all active habits with trigger_time set.
     *
     * Retrieves all habits that are active and have a trigger_time configured.
     * This is used by the FollowUpAgent to determine which habits need
     * reminders and follow-ups.
     *
     * @returns List of habit objects with trigger_time set. Returns an empty list if no habits are found.
     */
    async getHabitsWithTriggers() {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .not('trigger_time', 'is', null)
            .eq('active', true);
        if (error || !data) {
            return [];
        }
        return data;
    }
}
//# sourceMappingURL=habitRepository.js.map