/**
 * Sticky Repository
 *
 * Database operations for stickies table using the repository pattern.
 *
 * Requirements: 5.1
 */
import { BaseRepository } from './base.js';
/**
 * Repository for sticky database operations.
 *
 * This repository encapsulates all database operations for the stickies table,
 * providing methods for querying stickies by owner and completion status.
 */
export class StickyRepository extends BaseRepository {
    /**
     * Initialize the StickyRepository.
     *
     * @param supabase - The Supabase client instance.
     */
    constructor(supabase) {
        super(supabase, 'stickies');
    }
    /**
     * Get all stickies for an owner.
     *
     * Retrieves all stickies belonging to the specified owner,
     * ordered by display_order ascending.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @returns List of sticky objects for the owner. Returns an empty list if no stickies are found.
     */
    async getByOwner(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .order('display_order', { ascending: true });
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Get incomplete stickies for an owner.
     *
     * Retrieves all stickies that are not completed for the specified owner,
     * ordered by display_order ascending.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @returns List of incomplete sticky objects. Returns an empty list if no stickies are found.
     */
    async getIncomplete(ownerType, ownerId) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('completed', false)
            .order('display_order', { ascending: true });
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Get completed stickies for an owner.
     *
     * Retrieves all stickies that are completed for the specified owner,
     * ordered by completed_at descending (most recent first).
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param limit - Maximum number of completed stickies to return. Defaults to 10.
     * @returns List of completed sticky objects. Returns an empty list if no stickies are found.
     */
    async getCompleted(ownerType, ownerId, limit = 10) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .select('*')
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('completed', true)
            .order('completed_at', { ascending: false })
            .limit(limit);
        if (error || !data) {
            return [];
        }
        return data;
    }
    /**
     * Count stickies by completion status.
     *
     * @param ownerType - The type of owner (e.g., "user", "team").
     * @param ownerId - The unique identifier of the owner.
     * @param completed - Filter by completion status.
     * @returns Count of stickies matching the criteria.
     */
    async countByStatus(ownerType, ownerId, completed) {
        const { count, error } = await this.supabase
            .from(this.tableName)
            .select('id', { count: 'exact', head: true })
            .eq('owner_type', ownerType)
            .eq('owner_id', ownerId)
            .eq('completed', completed);
        if (error || count === null) {
            return 0;
        }
        return count;
    }
    /**
     * Mark a sticky as completed.
     *
     * @param id - The unique identifier of the sticky.
     * @returns The updated sticky if found, null otherwise.
     */
    async markCompleted(id) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
            completed: true,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select()
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
    /**
     * Mark a sticky as incomplete.
     *
     * @param id - The unique identifier of the sticky.
     * @returns The updated sticky if found, null otherwise.
     */
    async markIncomplete(id) {
        const { data, error } = await this.supabase
            .from(this.tableName)
            .update({
            completed: false,
            completed_at: null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', id)
            .select()
            .single();
        if (error || !data) {
            return null;
        }
        return data;
    }
}
//# sourceMappingURL=stickyRepository.js.map