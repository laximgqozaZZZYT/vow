/**
 * Goal Repository
 *
 * Database operations for goals table using the repository pattern.
 *
 * Requirements: 3.6
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.js';
import type { Goal } from '../schemas/habit.js';

/**
 * Repository for goal database operations.
 *
 * This repository encapsulates all database operations for the goals table,
 * providing methods for querying goals by owner and ID.
 */
export class GoalRepository extends BaseRepository<Goal> {
  /**
   * Initialize the GoalRepository.
   *
   * @param supabase - The Supabase client instance.
   */
  constructor(supabase: SupabaseClient) {
    super(supabase, 'goals');
  }

  /**
   * Get all goals for an owner.
   *
   * Retrieves all goals belonging to the specified owner. This is commonly
   * used for displaying goal lists and associating habits with goals.
   *
   * @param ownerType - The type of owner (e.g., "user", "team").
   * @param ownerId - The unique identifier of the owner.
   * @returns List of goal objects for the owner. Returns an empty list if no goals are found.
   */
  async getByOwner(ownerType: string, ownerId: string): Promise<Goal[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId);

    if (error || !data) {
      return [];
    }
    return data as Goal[];
  }

  /**
   * Get all active goals for an owner.
   *
   * Retrieves all goals that are currently active for the specified owner.
   * Active goals are those that have not been archived or completed.
   *
   * @param ownerType - The type of owner (e.g., "user", "team").
   * @param ownerId - The unique identifier of the owner.
   * @returns List of active goal objects for the owner. Returns an empty list if no active goals are found.
   */
  async getActiveGoals(ownerType: string, ownerId: string): Promise<Goal[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .eq('status', 'active');

    if (error || !data) {
      return [];
    }
    return data as Goal[];
  }

  /**
   * Find goal by exact name match (case-insensitive).
   *
   * Searches for a goal with the exact name for the specified owner.
   * The search is case-insensitive using ILIKE.
   *
   * @param ownerType - The type of owner (e.g., "user", "team").
   * @param ownerId - The unique identifier of the owner.
   * @param name - The exact name of the goal to find.
   * @returns The goal object if found, null otherwise.
   */
  async findByName(ownerType: string, ownerId: string, name: string): Promise<Goal | null> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .ilike('name', name);

    if (error || !data || data.length === 0) {
      return null;
    }
    return data[0] as Goal;
  }
}
