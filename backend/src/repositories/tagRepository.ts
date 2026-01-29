/**
 * Tag Repository
 *
 * Database operations for tags and entity_tags tables.
 * Used for tag-based skill level calculation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tag entity from the tags table.
 */
export interface Tag {
  id: string;
  name: string;
  color: string;
  ownerType: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Entity tag relationship from the entity_tags table.
 */
export interface EntityTag {
  id: string;
  entityType: 'diary_card' | 'goal' | 'habit' | 'activity' | 'mindmap';
  entityId: string;
  tagId: string;
  ownerType: string | null;
  ownerId: string | null;
  createdAt: Date;
}

/**
 * Tag with associated XP information for skill level calculation.
 */
export interface TagWithXP {
  tagId: string;
  tagName: string;
  tagColor: string;
  totalXP: number;
  activityCount: number;
  level: number;
}

/**
 * Repository for tag database operations.
 */
export class TagRepository {
  protected readonly supabase: SupabaseClient;
  protected readonly tableName = 'tags';

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get all tags for a user.
   */
  async getTagsByOwner(ownerType: string, ownerId: string): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .order('name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      color: row.color as string,
      ownerType: row.owner_type as string | null,
      ownerId: row.owner_id as string | null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    }));
  }

  /**
   * Get tags associated with a habit.
   */
  async getTagsForHabit(habitId: string): Promise<Tag[]> {
    const { data, error } = await this.supabase
      .from('entity_tags')
      .select(`
        tag_id,
        tags:tag_id (
          id,
          name,
          color,
          owner_type,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq('entity_type', 'habit')
      .eq('entity_id', habitId);

    if (error || !data) {
      return [];
    }

    return data
      .filter((row) => row.tags)
      .map((row) => {
        const tag = row.tags as unknown as Record<string, unknown>;
        return {
          id: tag['id'] as string,
          name: tag['name'] as string,
          color: tag['color'] as string,
          ownerType: tag['owner_type'] as string | null,
          ownerId: tag['owner_id'] as string | null,
          createdAt: new Date(tag['created_at'] as string),
          updatedAt: new Date(tag['updated_at'] as string),
        };
      });
  }

  /**
   * Get all habit-tag associations for a user.
   * Returns a map of habitId -> tagIds for efficient lookup.
   */
  async getHabitTagsForUser(userId: string): Promise<Map<string, string[]>> {
    const { data, error } = await this.supabase
      .from('entity_tags')
      .select('entity_id, tag_id')
      .eq('entity_type', 'habit')
      .eq('owner_type', 'user')
      .eq('owner_id', userId);

    if (error || !data) {
      return new Map();
    }

    const habitTagMap = new Map<string, string[]>();
    for (const row of data) {
      const habitId = row.entity_id as string;
      const tagId = row.tag_id as string;
      
      if (!habitTagMap.has(habitId)) {
        habitTagMap.set(habitId, []);
      }
      habitTagMap.get(habitId)!.push(tagId);
    }

    return habitTagMap;
  }

  /**
   * Get tag details by IDs.
   */
  async getTagsByIds(tagIds: string[]): Promise<Map<string, Tag>> {
    if (tagIds.length === 0) {
      return new Map();
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('*')
      .in('id', tagIds);

    if (error || !data) {
      return new Map();
    }

    const tagMap = new Map<string, Tag>();
    for (const row of data) {
      tagMap.set(row.id as string, {
        id: row.id as string,
        name: row.name as string,
        color: row.color as string,
        ownerType: row.owner_type as string | null,
        ownerId: row.owner_id as string | null,
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
      });
    }

    return tagMap;
  }
}
