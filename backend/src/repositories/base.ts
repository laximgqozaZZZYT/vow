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
export abstract class BaseRepository<T extends Record<string, unknown>> {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName: string;

  /**
   * Initialize the base repository.
   *
   * @param supabase - The Supabase client instance.
   * @param tableName - The name of the database table.
   */
  constructor(supabase: SupabaseClient, tableName: string) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  /**
   * Retrieve an entity by its ID.
   *
   * @param id - The unique identifier of the entity.
   * @returns The entity if found, null otherwise.
   */
  async getById(id: string): Promise<T | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }
    return data as T;
  }

  /**
   * Retrieve all entities with optional limit.
   *
   * @param limit - Maximum number of entities to retrieve. Defaults to 100.
   * @returns List of entities.
   */
  async getAll(limit = 100): Promise<T[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data as T[];
  }

  /**
   * Create a new entity.
   *
   * @param data - Object containing the entity data.
   * @returns The created entity.
   * @throws Error if the creation fails.
   */
  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error || !result) {
      throw new Error(`Failed to create entity in ${this.tableName}: ${error?.message ?? 'Unknown error'}`);
    }
    return result as T;
  }

  /**
   * Update an existing entity.
   *
   * @param id - The unique identifier of the entity to update.
   * @param data - Object containing the fields to update.
   * @returns The updated entity if found, null otherwise.
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) {
      return null;
    }
    return result as T;
  }

  /**
   * Delete an entity by its ID.
   *
   * @param id - The unique identifier of the entity to delete.
   * @returns True if the entity was deleted, false otherwise.
   */
  async delete(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  /**
   * Check if an entity exists by its ID.
   *
   * @param id - The unique identifier of the entity.
   * @returns True if the entity exists, false otherwise.
   */
  async exists(id: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('id')
      .eq('id', id)
      .limit(1);

    if (error) {
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  }

  /**
   * Count the total number of entities in the table.
   *
   * @returns The total count of entities.
   */
  async count(): Promise<number> {
    const { count, error } = await this.supabase
      .from(this.tableName)
      .select('id', { count: 'exact', head: true });

    if (error || count === null) {
      return 0;
    }
    return count;
  }
}
