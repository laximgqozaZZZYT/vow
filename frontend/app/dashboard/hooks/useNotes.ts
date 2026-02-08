'use client';

/**
 * useNotes Hook
 *
 * Custom hook for managing notes with CRUD operations,
 * optimistic updates, and error handling with rollback.
 *
 * Uses supabase-direct pattern via standalone API functions.
 *
 * @module hooks/useNotes
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseDirectClient } from '../../../lib/supabase-direct';
import type { Note, CreateNotePayload, UpdateNotePayload } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseNotesReturn {
  notes: Note[];
  loading: boolean;
  error: Error | null;
  createNote: (payload: CreateNotePayload) => Promise<Note>;
  updateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useNotes(options: { authToken?: string | null }): UseNotesReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Fetch all notes via supabase-direct.
   * The getNotes() function returns an array of camelCase Note objects.
   */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await supabaseDirectClient.getNotes();
      if (!mountedRef.current) return;

      setNotes(res || []);
    } catch (err) {
      if (!mountedRef.current) return;
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      console.error('[useNotes] Failed to fetch notes:', e);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Create a new note with optimistic update.
   * apiCreateNote() returns a single camelCase Note object.
   */
  const createNote = useCallback(async (payload: CreateNotePayload): Promise<Note> => {
    setError(null);

    try {
      const note = await supabaseDirectClient.createNote(payload);
      if (!note) {
        throw new Error('No note returned from API');
      }

      if (mountedRef.current) {
        setNotes((prev) => [note, ...prev]);
      }

      return note;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setError(e);
      }
      console.error('[useNotes] Failed to create note:', e);
      throw e;
    }
  }, []);

  /**
   * Update an existing note with optimistic update and rollback on failure.
   */
  const updateNote = useCallback(async (id: string, payload: UpdateNotePayload): Promise<void> => {
    setError(null);

    // Capture previous state for rollback
    const previousNotes = notes;

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, ...payload, updatedAt: new Date().toISOString() }
          : n
      )
    );

    try {
      await supabaseDirectClient.updateNote(id, payload);
    } catch (err) {
      // Rollback on failure
      if (mountedRef.current) {
        setNotes(previousNotes);
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        console.error('[useNotes] Failed to update note:', e);
      }
      throw err;
    }
  }, [notes]);

  /**
   * Delete a note with optimistic update and rollback on failure.
   */
  const deleteNote = useCallback(async (id: string): Promise<void> => {
    setError(null);

    // Capture previous state for rollback
    const previousNotes = notes;

    // Optimistic update
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      await supabaseDirectClient.deleteNote(id);
    } catch (err) {
      // Rollback on failure
      if (mountedRef.current) {
        setNotes(previousNotes);
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        console.error('[useNotes] Failed to delete note:', e);
      }
      throw err;
    }
  }, [notes]);

  return {
    notes,
    loading,
    error,
    createNote,
    updateNote,
    deleteNote,
    refresh,
  };
}

export default useNotes;
