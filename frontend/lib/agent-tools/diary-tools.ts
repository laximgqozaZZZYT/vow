/**
 * Agent Tools - Diary Tools
 *
 * Tools for diary/journal management operations.
 * Used by AI agents to create, read, and update diary entries.
 */

import { z } from 'zod';
import type { AgentTool, ToolContext, ToolResult } from './types';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Schema for creating a new diary entry.
 */
export const CreateDiaryEntrySchema = z.object({
  frontMd: z
    .string()
    .min(1, 'Front content is required / フロント内容は必須です')
    .max(10000, 'Front content too long / フロント内容が長すぎます')
    .describe('Front/summary of the diary entry in Markdown'),
  backMd: z
    .string()
    .max(10000, 'Back content too long / バック内容が長すぎます')
    .default('')
    .describe('Back/detailed content in Markdown'),
  tags: z.array(z.string()).optional().describe('Tag names to attach to the entry'),
});

export type CreateDiaryEntryInput = z.infer<typeof CreateDiaryEntrySchema>;

/**
 * Schema for getting diary entries.
 */
export const GetDiaryEntriesSchema = z.object({
  startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
  search: z.string().optional().describe('Search query for content'),
  tags: z.array(z.string()).optional().describe('Filter by tag names'),
  limit: z.number().int().positive().max(100).default(20).describe('Maximum number of entries'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

export type GetDiaryEntriesInput = z.infer<typeof GetDiaryEntriesSchema>;

/**
 * Schema for updating a diary entry.
 */
export const UpdateDiaryEntrySchema = z.object({
  entryId: z.string().uuid().describe('Diary entry ID to update'),
  frontMd: z.string().min(1).max(10000).optional(),
  backMd: z.string().max(10000).optional(),
  tags: z.array(z.string()).optional().describe('Replace all tags with these'),
});

export type UpdateDiaryEntryInput = z.infer<typeof UpdateDiaryEntrySchema>;

// ============================================================================
// Response Types
// ============================================================================

export interface DiaryEntry {
  id: string;
  frontMd: string;
  backMd: string;
  tags?: DiaryTag[];
  createdAt: string;
  updatedAt: string;
}

export interface DiaryTag {
  id: string;
  name: string;
  color?: string;
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Create a new diary entry.
 */
export const createDiaryEntryTool: AgentTool<CreateDiaryEntryInput, ToolResult<DiaryEntry>> = {
  name: 'create_diary_entry',
  description:
    'Create a new diary entry. Entries have front (summary) and back (detailed) content in Markdown format.',
  inputSchema: CreateDiaryEntrySchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          insert: (data: unknown) => {
            select: () => {
              single: () => Promise<{ data: DiaryEntry | null; error: Error | null }>;
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              in?: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: Error | null }>;
            } & Promise<{ data: unknown[] | null; error: Error | null }>;
          };
          upsert: (data: unknown[], options?: { onConflict: string }) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };

      // Create the diary entry
      const { data, error } = await client
        .from('diary_cards')
        .insert({
          owner_type: 'user',
          owner_id: userId,
          front_md: input.frontMd,
          back_md: input.backMd,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'CREATE_DIARY_ENTRY_FAILED',
            message: error.message,
          },
        };
      }

      let tags: DiaryTag[] = [];

      // Handle tags if provided
      if (input.tags && input.tags.length > 0) {
        // Get or create tags
        const tagResults = await ensureTags(client, userId, input.tags);
        tags = tagResults;

        // Link tags to diary entry using entity_tags
        const entryId = (data as unknown as { id: string }).id;
        await linkTagsToEntity(client, userId, 'diary_card', entryId, tagResults.map(t => t.id));
      }

      return {
        success: true,
        data: {
          ...transformDiaryEntryFromDb(data),
          tags,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

/**
 * Get diary entries for the current user.
 */
export const getDiaryEntriesTool: AgentTool<GetDiaryEntriesInput, ToolResult<DiaryEntry[]>> = {
  name: 'get_diary_entries',
  description:
    'Get diary entries for the current user. Can filter by date range, search query, and tags.',
  inputSchema: GetDiaryEntriesSchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      // Chainable query type for Supabase-like client
      type ChainableQuery = {
        eq: (column: string, value: unknown) => ChainableQuery;
        gte: (column: string, value: string) => ChainableQuery;
        lte: (column: string, value: string) => ChainableQuery;
        or: (filter: string) => ChainableQuery;
        order: (column: string, options: { ascending: boolean }) => {
          range: (start: number, end: number) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };

      const client = supabaseClient as {
        from: (table: string) => {
          select: (columns: string) => ChainableQuery;
        };
      };

      let query: ChainableQuery = client.from('diary_cards').select('*').eq('owner_id', userId);

      if (input.startDate) {
        query = query.gte('created_at', `${input.startDate}T00:00:00Z`);
      }

      if (input.endDate) {
        query = query.lte('created_at', `${input.endDate}T23:59:59Z`);
      }

      if (input.search) {
        // Search in both front and back content
        const searchFilter = `front_md.ilike.%${input.search}%,back_md.ilike.%${input.search}%`;
        query = query.or(searchFilter);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        return {
          success: false,
          error: {
            code: 'GET_DIARY_ENTRIES_FAILED',
            message: error.message,
          },
        };
      }

      const entries = (data ?? []).map(transformDiaryEntryFromDb);

      // TODO: Fetch and attach tags for each entry if needed
      // For now, return entries without tags to avoid complex joins

      return {
        success: true,
        data: entries,
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

/**
 * Update an existing diary entry.
 */
export const updateDiaryEntryTool: AgentTool<UpdateDiaryEntryInput, ToolResult<DiaryEntry>> = {
  name: 'update_diary_entry',
  description: 'Update an existing diary entry. Only provided fields will be updated.',
  inputSchema: UpdateDiaryEntrySchema,
  execute: async (input, context) => {
    try {
      const { userId, supabaseClient } = context;
      const client = supabaseClient as {
        from: (table: string) => {
          update: (data: unknown) => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => {
                select: () => {
                  single: () => Promise<{ data: DiaryEntry | null; error: Error | null }>;
                };
              };
            };
          };
          delete: () => {
            eq: (column: string, value: unknown) => {
              eq: (column: string, value: unknown) => Promise<{ error: Error | null }>;
            };
          };
          select: (columns: string) => {
            eq: (column: string, value: unknown) => {
              in?: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: Error | null }>;
            } & Promise<{ data: unknown[] | null; error: Error | null }>;
          };
          upsert: (data: unknown[], options?: { onConflict: string }) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };

      const { entryId, tags: tagNames, ...updates } = input;

      // Convert camelCase to snake_case for DB
      const dbUpdates: Record<string, unknown> = {};
      if (updates.frontMd !== undefined) dbUpdates.front_md = updates.frontMd;
      if (updates.backMd !== undefined) dbUpdates.back_md = updates.backMd;
      dbUpdates.updated_at = new Date().toISOString();

      const { data, error } = await client
        .from('diary_cards')
        .update(dbUpdates)
        .eq('id', entryId)
        .eq('owner_id', userId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: 'UPDATE_DIARY_ENTRY_FAILED',
            message: error.message,
          },
        };
      }

      let tags: DiaryTag[] = [];

      // Handle tags if provided (replace all tags)
      if (tagNames !== undefined) {
        // Remove existing tag links
        await client
          .from('entity_tags')
          .delete()
          .eq('entity_type', 'diary_card')
          .eq('entity_id', entryId);

        if (tagNames.length > 0) {
          // Get or create tags
          const tagResults = await ensureTags(client, userId, tagNames);
          tags = tagResults;

          // Link new tags
          await linkTagsToEntity(client, userId, 'diary_card', entryId, tagResults.map(t => t.id));
        }
      }

      return {
        success: true,
        data: {
          ...transformDiaryEntryFromDb(data),
          tags,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error / 不明なエラー',
        },
      };
    }
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transform database row to DiaryEntry type.
 */
function transformDiaryEntryFromDb(row: unknown): DiaryEntry {
  const r = row as {
    id: string;
    front_md: string;
    back_md: string;
    created_at: string;
    updated_at: string;
  };

  return {
    id: r.id,
    frontMd: r.front_md,
    backMd: r.back_md,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Ensure tags exist in the database, creating them if necessary.
 */
async function ensureTags(
  client: unknown,
  userId: string,
  tagNames: string[]
): Promise<DiaryTag[]> {
  const c = client as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: Error | null }>;
        };
      };
      insert: (data: unknown[]) => {
        select: () => Promise<{ data: unknown[] | null; error: Error | null }>;
      };
    };
  };

  // Get existing tags
  const { data: existingTags } = await c
    .from('tags')
    .select('id, name, color')
    .eq('owner_id', userId)
    .in('name', tagNames);

  const existingNames = new Set((existingTags ?? []).map((t: unknown) => (t as { name: string }).name));
  const newTagNames = tagNames.filter((name) => !existingNames.has(name));

  let createdTags: DiaryTag[] = [];

  // Create missing tags
  if (newTagNames.length > 0) {
    const { data: newTags } = await c
      .from('tags')
      .insert(
        newTagNames.map((name) => ({
          owner_type: 'user',
          owner_id: userId,
          name,
        }))
      )
      .select();

    createdTags = (newTags ?? []).map((t: unknown) => {
      const tag = t as { id: string; name: string; color?: string };
      return { id: tag.id, name: tag.name, color: tag.color };
    });
  }

  const allTags = [
    ...(existingTags ?? []).map((t: unknown) => {
      const tag = t as { id: string; name: string; color?: string };
      return { id: tag.id, name: tag.name, color: tag.color };
    }),
    ...createdTags,
  ];

  return allTags;
}

/**
 * Link tags to an entity via the entity_tags table.
 */
async function linkTagsToEntity(
  client: unknown,
  userId: string,
  entityType: string,
  entityId: string,
  tagIds: string[]
): Promise<void> {
  const c = client as {
    from: (table: string) => {
      insert: (data: unknown[]) => Promise<{ error: Error | null }>;
    };
  };

  await c.from('entity_tags').insert(
    tagIds.map((tagId) => ({
      owner_type: 'user',
      owner_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      tag_id: tagId,
    }))
  );
}

// ============================================================================
// Tool Collection Export
// ============================================================================

/**
 * All diary-related tools for agent registration.
 */
export const diaryTools = {
  createDiaryEntry: createDiaryEntryTool,
  getDiaryEntries: getDiaryEntriesTool,
  updateDiaryEntry: updateDiaryEntryTool,
} as const;

/**
 * Array of all diary tools for registration.
 */
export const diaryToolList = Object.values(diaryTools);
