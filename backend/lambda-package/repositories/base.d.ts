/**
 * Base Repository
 *
 * Abstract base class for repository pattern implementation with generic CRUD operations.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
import type { SupabaseClient } from '@supabase/supabase-js';
/**
 * Base repository with common CRUD operations.
 *
 * This abstract base class provides a consistent interface for database operations
 * across all repositories. It uses the Supabase client for data access and supports
 * generic typing for type-safe operations.
 */
export declare abstract class BaseRepository<T extends Record<string, unknown>> {
    protected readonly supabase: SupabaseClient;
    protected readonly tableName: string;
    /**
     * Initialize the base repository.
     *
     * @param supabase - The Supabase client instance.
     * @param tableName - The name of the database table.
     */
    constructor(supabase: SupabaseClient, tableName: string);
    /**
     * Retrieve an entity by its ID.
     *
     * @param id - The unique identifier of the entity.
     * @returns The entity if found, null otherwise.
     */
    getById(id: string): Promise<T | null>;
    /**
     * Retrieve all entities with optional limit.
     *
     * @param limit - Maximum number of entities to retrieve. Defaults to 100.
     * @returns List of entities.
     */
    getAll(limit?: number): Promise<T[]>;
    /**
     * Create a new entity.
     *
     * @param data - Object containing the entity data.
     * @returns The created entity.
     * @throws Error if the creation fails.
     */
    create(data: Partial<T>): Promise<T>;
    /**
     * Update an existing entity.
     *
     * @param id - The unique identifier of the entity to update.
     * @param data - Object containing the fields to update.
     * @returns The updated entity if found, null otherwise.
     */
    update(id: string, data: Partial<T>): Promise<T | null>;
    /**
     * Delete an entity by its ID.
     *
     * @param id - The unique identifier of the entity to delete.
     * @returns True if the entity was deleted, false otherwise.
     */
    delete(id: string): Promise<boolean>;
    /**
     * Check if an entity exists by its ID.
     *
     * @param id - The unique identifier of the entity.
     * @returns True if the entity exists, false otherwise.
     */
    exists(id: string): Promise<boolean>;
    /**
     * Count the total number of entities in the table.
     *
     * @returns The total count of entities.
     */
    count(): Promise<number>;
}
//# sourceMappingURL=base.d.ts.map