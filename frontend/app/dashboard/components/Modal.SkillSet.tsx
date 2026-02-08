'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SkillSet,
  Note,
  CreateNotePayload,
  UpdateNotePayload,
  CreateSkillSetPayload,
  UpdateSkillSetPayload,
  Sticky,
  Goal,
  Habit,
} from '../types';

// =============================================================================
// Props
// =============================================================================

export interface SkillSetModalProps {
  mode: 'create' | 'edit' | 'view';
  skillSet?: SkillSet;
  notes: Note[];
  stickies: Sticky[];
  goals: Goal[];
  habits: Habit[];
  locale: 'ja' | 'en';
  onSave: (payload: CreateSkillSetPayload | UpdateSkillSetPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
  onExecute?: () => Promise<void>;
  onCreateNote: (payload: CreateNotePayload) => Promise<Note>;
  onUpdateNote: (id: string, payload: UpdateNotePayload) => Promise<void>;
  onCreateSticky: (name: string, description?: string) => Promise<Sticky>;
  onClose: () => void;
  isRemoteCliConnected: boolean;
}

// =============================================================================
// i18n Labels
// =============================================================================

const LABELS = {
  ja: {
    titleCreate: 'スキルセット作成',
    titleEdit: 'スキルセット編集',
    titleView: 'スキルセット詳細',
    name: '名前',
    namePlaceholder: 'スキルセット名を入力',
    description: '説明',
    descriptionPlaceholder: '説明を入力（任意）',
    mainPrompt: 'メインプロンプト (Note)',
    none: 'なし',
    createNew: '新規作成',
    noteTitle: 'タイトル',
    noteTitlePlaceholder: 'Noteタイトル',
    noteContent: '内容',
    noteContentPlaceholder: 'プロンプト内容を入力...',
    create: '作成',
    edit: '編集',
    save: '保存',
    cancel: 'キャンセル',
    delete: '削除',
    execute: '実行する',
    deleteConfirm: '本当に削除しますか？',
    deleteConfirmYes: '削除する',
    deleteConfirmNo: 'キャンセル',
    subInstructions: 'サブ指示 (Sticky\'n)',
    noSubInstructions: 'サブ指示がありません',
    up: '上',
    down: '下',
    remove: '削除',
    stickyName: '名前',
    stickyNamePlaceholder: 'Sticky名',
    stickyDescription: '説明',
    stickyDescriptionPlaceholder: '説明（任意）',
    goalHabitLinks: 'Goal / Habit 紐づけ',
    addGoal: 'Goal追加',
    addHabit: 'Habit追加',
    executionHistory: '実行履歴',
    lastExecutedAt: '最終実行日時',
    notExecuted: '未実行',
    executionResult: '実行結果',
    statusSuccess: '成功',
    statusError: 'エラー',
    statusCancelled: 'キャンセル済',
    remoteCliNotConnected: 'Remote CLI未接続',
    nameRequired: '名前を入力してください',
    selectNote: 'Noteを選択',
    selectSticky: 'Stickyを選択',
    selectGoal: 'Goalを選択',
    selectHabit: 'Habitを選択',
    notePreviewEmpty: 'Noteの内容がありません',
    saving: '保存中...',
    close: '閉じる',
  },
  en: {
    titleCreate: 'Create Skill Set',
    titleEdit: 'Edit Skill Set',
    titleView: 'Skill Set Details',
    name: 'Name',
    namePlaceholder: 'Enter skill set name',
    description: 'Description',
    descriptionPlaceholder: 'Enter description (optional)',
    mainPrompt: 'Main Prompt (Note)',
    none: 'None',
    createNew: 'Create New',
    noteTitle: 'Title',
    noteTitlePlaceholder: 'Note title',
    noteContent: 'Content',
    noteContentPlaceholder: 'Enter prompt content...',
    create: 'Create',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    execute: 'Execute',
    deleteConfirm: 'Are you sure you want to delete?',
    deleteConfirmYes: 'Delete',
    deleteConfirmNo: 'Cancel',
    subInstructions: 'Sub-Instructions (Sticky\'n)',
    noSubInstructions: 'No sub-instructions',
    up: 'Up',
    down: 'Down',
    remove: 'Remove',
    stickyName: 'Name',
    stickyNamePlaceholder: 'Sticky name',
    stickyDescription: 'Description',
    stickyDescriptionPlaceholder: 'Description (optional)',
    goalHabitLinks: 'Goal / Habit Links',
    addGoal: 'Add Goal',
    addHabit: 'Add Habit',
    executionHistory: 'Execution History',
    lastExecutedAt: 'Last Executed',
    notExecuted: 'Not executed',
    executionResult: 'Execution Result',
    statusSuccess: 'Success',
    statusError: 'Error',
    statusCancelled: 'Cancelled',
    remoteCliNotConnected: 'Remote CLI not connected',
    nameRequired: 'Please enter a name',
    selectNote: 'Select a note',
    selectSticky: 'Select a sticky',
    selectGoal: 'Select a goal',
    selectHabit: 'Select a habit',
    notePreviewEmpty: 'Note content is empty',
    saving: 'Saving...',
    close: 'Close',
  },
} as const;

// =============================================================================
// Helpers
// =============================================================================

/** Truncate text to a given max length */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

/** Format ISO date string for display */
function formatDateTime(isoString: string, locale: 'ja' | 'en'): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

// =============================================================================
// Component
// =============================================================================

export function SkillSetModal({
  mode,
  skillSet,
  notes,
  stickies,
  goals,
  habits,
  locale,
  onSave,
  onDelete,
  onExecute,
  onCreateNote,
  onUpdateNote,
  onCreateSticky,
  onClose,
  isRemoteCliConnected,
}: SkillSetModalProps) {
  const t = LABELS[locale];
  const isViewMode = mode === 'view';
  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';
  const modalRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Form State
  // ---------------------------------------------------------------------------

  const [name, setName] = useState(skillSet?.name || '');
  const [description, setDescription] = useState(skillSet?.description || '');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(skillSet?.noteId || null);
  const [selectedStickyIds, setSelectedStickyIds] = useState<string[]>(
    () => skillSet?.stickies?.sort((a, b) => a.displayOrder - b.displayOrder).map(s => s.stickyId) || []
  );
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(
    () => skillSet?.goals?.map(g => g.goalId) || []
  );
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>(
    () => skillSet?.habits?.map(h => h.habitId) || []
  );

  // Inline creation states
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteContent, setEditNoteContent] = useState('');

  const [isCreatingSticky, setIsCreatingSticky] = useState(false);
  const [newStickyName, setNewStickyName] = useState('');
  const [newStickyDescription, setNewStickyDescription] = useState('');
  const [createdStickies, setCreatedStickies] = useState<Sticky[]>([]);

  // Dropdown open states
  const [showGoalDropdown, setShowGoalDropdown] = useState(false);
  const [showHabitDropdown, setShowHabitDropdown] = useState(false);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  const selectedNote = notes.find(n => n.id === selectedNoteId) || null;
  const allStickies = [...stickies, ...createdStickies.filter(cs => !stickies.some(s => s.id === cs.id))];
  const selectedStickyObjects = selectedStickyIds
    .map(id => allStickies.find(s => s.id === id))
    .filter((s): s is Sticky => s !== undefined);

  const availableGoals = goals.filter(g => !selectedGoalIds.includes(g.id));
  const availableHabits = habits.filter(h => !selectedHabitIds.includes(h.id));

  const modalTitle = isCreateMode ? t.titleCreate : isEditMode ? t.titleEdit : t.titleView;

  // ---------------------------------------------------------------------------
  // ESC key and Focus Trap
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Focus trap: Tab within modal
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Auto-focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setValidationError(t.nameRequired);
      return;
    }
    setValidationError(null);
    setIsSaving(true);

    try {
      if (isCreateMode) {
        const payload: CreateSkillSetPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          noteId: selectedNoteId || undefined,
          stickyIds: selectedStickyIds.length > 0 ? selectedStickyIds : undefined,
          goalIds: selectedGoalIds.length > 0 ? selectedGoalIds : undefined,
          habitIds: selectedHabitIds.length > 0 ? selectedHabitIds : undefined,
        };
        await onSave(payload);
      } else if (isEditMode && skillSet) {
        // Compute diffs for update payload
        const originalStickyIds = skillSet.stickies?.map(s => s.stickyId) || [];
        const originalGoalIds = skillSet.goals?.map(g => g.goalId) || [];
        const originalHabitIds = skillSet.habits?.map(h => h.habitId) || [];

        const payload: UpdateSkillSetPayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          noteId: selectedNoteId,
          addStickyIds: selectedStickyIds.filter(id => !originalStickyIds.includes(id)),
          removeStickyIds: originalStickyIds.filter(id => !selectedStickyIds.includes(id)),
          addGoalIds: selectedGoalIds.filter(id => !originalGoalIds.includes(id)),
          removeGoalIds: originalGoalIds.filter(id => !selectedGoalIds.includes(id)),
          addHabitIds: selectedHabitIds.filter(id => !originalHabitIds.includes(id)),
          removeHabitIds: originalHabitIds.filter(id => !selectedHabitIds.includes(id)),
        };
        await onSave(payload);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save skill set:', error);
    } finally {
      setIsSaving(false);
    }
  }, [
    name, description, selectedNoteId, selectedStickyIds, selectedGoalIds,
    selectedHabitIds, isCreateMode, isEditMode, skillSet, onSave, onClose, t,
  ]);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete skill set:', error);
    }
  }, [onDelete, onClose]);

  const handleExecute = useCallback(async () => {
    if (!onExecute || !isRemoteCliConnected || !selectedNoteId) return;
    try {
      await onExecute();
    } catch (error) {
      console.error('Failed to execute skill set:', error);
    }
  }, [onExecute, isRemoteCliConnected, selectedNoteId]);

  // Note creation
  const handleCreateNote = useCallback(async () => {
    if (!newNoteTitle.trim()) return;
    try {
      const created = await onCreateNote({
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
      });
      setSelectedNoteId(created.id);
      setIsCreatingNote(false);
      setNewNoteTitle('');
      setNewNoteContent('');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  }, [newNoteTitle, newNoteContent, onCreateNote]);

  // Note editing (save)
  const handleSaveNoteEdit = useCallback(async () => {
    if (!selectedNoteId) return;
    try {
      await onUpdateNote(selectedNoteId, { content: editNoteContent });
      setIsEditingNote(false);
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  }, [selectedNoteId, editNoteContent, onUpdateNote]);

  // Start editing note
  const handleStartEditNote = useCallback(() => {
    if (selectedNote) {
      setEditNoteContent(selectedNote.content);
      setIsEditingNote(true);
    }
  }, [selectedNote]);

  // Sticky creation
  const handleCreateSticky = useCallback(async () => {
    if (!newStickyName.trim()) return;
    try {
      const created = await onCreateSticky(
        newStickyName.trim(),
        newStickyDescription.trim() || undefined,
      );
      setCreatedStickies(prev => [...prev, created]);
      setSelectedStickyIds(prev => [...prev, created.id]);
      setIsCreatingSticky(false);
      setNewStickyName('');
      setNewStickyDescription('');
    } catch (error) {
      console.error('Failed to create sticky:', error);
    }
  }, [newStickyName, newStickyDescription, onCreateSticky]);

  // Sticky reorder
  const handleMoveStickyUp = useCallback((index: number) => {
    if (index <= 0) return;
    setSelectedStickyIds(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveStickyDown = useCallback((index: number) => {
    setSelectedStickyIds(prev => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleRemoveSticky = useCallback((stickyId: string) => {
    setSelectedStickyIds(prev => prev.filter(id => id !== stickyId));
  }, []);

  // Goal / Habit add/remove
  const handleAddGoal = useCallback((goalId: string) => {
    setSelectedGoalIds(prev => [...prev, goalId]);
    setShowGoalDropdown(false);
  }, []);

  const handleRemoveGoal = useCallback((goalId: string) => {
    setSelectedGoalIds(prev => prev.filter(id => id !== goalId));
  }, []);

  const handleAddHabit = useCallback((habitId: string) => {
    setSelectedHabitIds(prev => [...prev, habitId]);
    setShowHabitDropdown(false);
  }, []);

  const handleRemoveHabit = useCallback((habitId: string) => {
    setSelectedHabitIds(prev => prev.filter(id => id !== habitId));
  }, []);

  // ---------------------------------------------------------------------------
  // Execution result status badge
  // ---------------------------------------------------------------------------

  const getStatusBadge = (status: 'success' | 'error' | 'cancelled') => {
    const config = {
      success: { text: t.statusSuccess, className: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
      error: { text: t.statusError, className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
      cancelled: { text: t.statusCancelled, className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
    };
    const c = config[status];
    return (
      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${c.className}`}>
        {c.text}
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4"
      >
        {/* ================================================================= */}
        {/* 1. Header                                                         */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">{modalTitle}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md transition-colors"
            aria-label={t.close}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ================================================================= */}
        {/* Content Area                                                      */}
        {/* ================================================================= */}
        <div className="px-6 py-4 space-y-6">

          {/* =============================================================== */}
          {/* 2. Name & Description                                           */}
          {/* =============================================================== */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t.name} <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isViewMode}
                placeholder={t.namePlaceholder}
                className="
                  flex h-10 w-full rounded-md border border-input bg-background
                  px-3 py-2 text-sm placeholder:text-muted-foreground
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              />
              {validationError && (
                <p className="mt-1 text-xs text-destructive">{validationError}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t.description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isViewMode}
                placeholder={t.descriptionPlaceholder}
                rows={3}
                className="
                  flex min-h-[80px] w-full rounded-md border border-input bg-background
                  px-3 py-2 text-sm placeholder:text-muted-foreground
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  resize-none disabled:opacity-60 disabled:cursor-not-allowed
                "
              />
            </div>
          </div>

          {/* =============================================================== */}
          {/* 3. Main Prompt (Note) Section                                   */}
          {/* =============================================================== */}
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t.mainPrompt}</h3>

            {/* Note Selector */}
            <div className="flex items-center gap-2 mb-3">
              <select
                value={selectedNoteId || ''}
                onChange={(e) => {
                  setSelectedNoteId(e.target.value || null);
                  setIsEditingNote(false);
                }}
                disabled={isViewMode}
                className="
                  flex h-10 flex-1 rounded-md border border-input bg-background
                  px-3 py-2 text-sm
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                <option value="">{t.none}</option>
                {notes.map(note => (
                  <option key={note.id} value={note.id}>{note.title}</option>
                ))}
              </select>

              {!isViewMode && (
                <button
                  onClick={() => {
                    setIsCreatingNote(!isCreatingNote);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                  className="
                    px-3 py-2 text-sm font-medium
                    text-primary hover:text-primary/80
                    border border-primary/30 rounded-md
                    hover:bg-primary/5 transition-colors
                    whitespace-nowrap
                  "
                >
                  {t.createNew}
                </button>
              )}
            </div>

            {/* Inline Note Creation Form */}
            {isCreatingNote && !isViewMode && (
              <div className="p-3 border border-border rounded-lg bg-muted/30 mb-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t.noteTitle}
                  </label>
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder={t.noteTitlePlaceholder}
                    className="
                      flex h-9 w-full rounded-md border border-input bg-background
                      px-3 py-1.5 text-sm placeholder:text-muted-foreground
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    "
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t.noteContent}
                  </label>
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder={t.noteContentPlaceholder}
                    rows={4}
                    className="
                      flex min-h-[80px] w-full rounded-md border border-input bg-background
                      px-3 py-1.5 text-sm placeholder:text-muted-foreground
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                      resize-none
                    "
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsCreatingNote(false)}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleCreateNote}
                    disabled={!newNoteTitle.trim()}
                    className="
                      px-3 py-1.5 text-xs font-medium text-white
                      bg-primary hover:bg-primary/90
                      disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
                      rounded-md transition-colors
                    "
                  >
                    {t.create}
                  </button>
                </div>
              </div>
            )}

            {/* Note Preview */}
            {selectedNote && (
              <div className="p-3 border border-border rounded-lg bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{selectedNote.title}</span>
                  {!isViewMode && !isEditingNote && (
                    <button
                      onClick={handleStartEditNote}
                      className="px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                    >
                      {t.edit}
                    </button>
                  )}
                </div>
                {isEditingNote && !isViewMode ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      rows={6}
                      className="
                        flex min-h-[120px] w-full rounded-md border border-input bg-background
                        px-3 py-2 text-sm font-mono
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                        resize-none
                      "
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setIsEditingNote(false)}
                        className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t.cancel}
                      </button>
                      <button
                        onClick={handleSaveNoteEdit}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                      >
                        {t.save}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedNote.content
                      ? truncate(selectedNote.content, 300)
                      : t.notePreviewEmpty}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* 4. Sub-Instructions (Sticky'n) Section                          */}
          {/* =============================================================== */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">{t.subInstructions}</h3>
              {!isViewMode && (
                <button
                    onClick={() => {
                      setIsCreatingSticky(!isCreatingSticky);
                      setNewStickyName('');
                      setNewStickyDescription('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                  >
                    {t.createNew}
                  </button>
              )}
            </div>

            {/* Inline Sticky Creation */}
            {isCreatingSticky && !isViewMode && (
              <div className="p-3 border border-border rounded-lg bg-muted/30 mb-3 space-y-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t.stickyName}
                  </label>
                  <input
                    type="text"
                    value={newStickyName}
                    onChange={(e) => setNewStickyName(e.target.value)}
                    placeholder={t.stickyNamePlaceholder}
                    className="
                      flex h-9 w-full rounded-md border border-input bg-background
                      px-3 py-1.5 text-sm placeholder:text-muted-foreground
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    "
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t.stickyDescription}
                  </label>
                  <input
                    type="text"
                    value={newStickyDescription}
                    onChange={(e) => setNewStickyDescription(e.target.value)}
                    placeholder={t.stickyDescriptionPlaceholder}
                    className="
                      flex h-9 w-full rounded-md border border-input bg-background
                      px-3 py-1.5 text-sm placeholder:text-muted-foreground
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    "
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsCreatingSticky(false)}
                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={handleCreateSticky}
                    disabled={!newStickyName.trim()}
                    className="
                      px-3 py-1.5 text-xs font-medium text-white
                      bg-primary hover:bg-primary/90
                      disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
                      rounded-md transition-colors
                    "
                  >
                    {t.create}
                  </button>
                </div>
              </div>
            )}

            {/* Selected Stickies List */}
            {selectedStickyObjects.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">{t.noSubInstructions}</p>
            ) : (
              <div className="space-y-1">
                {selectedStickyIds.map((stickyId, index) => {
                  const sticky = allStickies.find(s => s.id === stickyId);
                  if (!sticky) return null;
                  return (
                    <div
                      key={stickyId}
                      className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">
                        {index + 1}.
                      </span>
                      <span className="text-sm text-foreground flex-1 truncate">
                        {sticky.name}
                      </span>
                      {!isViewMode && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleMoveStickyUp(index)}
                            disabled={index === 0}
                            className="
                              px-1.5 py-0.5 text-xs text-muted-foreground
                              hover:text-foreground hover:bg-muted
                              disabled:opacity-30 disabled:cursor-not-allowed
                              rounded transition-colors
                            "
                            aria-label={`${t.up} ${sticky.name}`}
                          >
                            &uarr;
                          </button>
                          <button
                            onClick={() => handleMoveStickyDown(index)}
                            disabled={index === selectedStickyIds.length - 1}
                            className="
                              px-1.5 py-0.5 text-xs text-muted-foreground
                              hover:text-foreground hover:bg-muted
                              disabled:opacity-30 disabled:cursor-not-allowed
                              rounded transition-colors
                            "
                            aria-label={`${t.down} ${sticky.name}`}
                          >
                            &darr;
                          </button>
                          <button
                            onClick={() => handleRemoveSticky(stickyId)}
                            className="
                              px-1.5 py-0.5 text-xs text-destructive
                              hover:text-destructive/80 hover:bg-destructive/10
                              rounded transition-colors
                            "
                            aria-label={`${t.remove} ${sticky.name}`}
                          >
                            &times;
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* 5. Goal / Habit Linking Section                                  */}
          {/* =============================================================== */}
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">{t.goalHabitLinks}</h3>

            {/* Goals Sub-section */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">Goals</span>
                {!isViewMode && (
                  <div className="relative">
                    <button
                      onClick={() => setShowGoalDropdown(!showGoalDropdown)}
                      className="px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                    >
                      {t.addGoal}
                    </button>
                    {showGoalDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-10">
                        {availableGoals.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-3 py-2">-</p>
                        ) : (
                          availableGoals.map(goal => (
                            <button
                              key={goal.id}
                              onClick={() => handleAddGoal(goal.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                            >
                              {goal.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedGoalIds.map(goalId => {
                  const goal = goals.find(g => g.id === goalId);
                  if (!goal) return null;
                  return (
                    <span
                      key={goalId}
                      className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full"
                    >
                      {goal.name}
                      {!isViewMode && (
                        <button
                          onClick={() => handleRemoveGoal(goalId)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                          aria-label={`${t.remove} ${goal.name}`}
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  );
                })}
                {selectedGoalIds.length === 0 && (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            </div>

            {/* Habits Sub-section */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">Habits</span>
                {!isViewMode && (
                  <div className="relative">
                    <button
                      onClick={() => setShowHabitDropdown(!showHabitDropdown)}
                      className="px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                    >
                      {t.addHabit}
                    </button>
                    {showHabitDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-56 max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-10">
                        {availableHabits.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-3 py-2">-</p>
                        ) : (
                          availableHabits.map(habit => (
                            <button
                              key={habit.id}
                              onClick={() => handleAddHabit(habit.id)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors text-foreground"
                            >
                              {habit.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedHabitIds.map(habitId => {
                  const habit = habits.find(h => h.id === habitId);
                  if (!habit) return null;
                  return (
                    <span
                      key={habitId}
                      className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full"
                    >
                      {habit.name}
                      {!isViewMode && (
                        <button
                          onClick={() => handleRemoveHabit(habitId)}
                          className="text-muted-foreground hover:text-destructive transition-colors ml-0.5"
                          aria-label={`${t.remove} ${habit.name}`}
                        >
                          &times;
                        </button>
                      )}
                    </span>
                  );
                })}
                {selectedHabitIds.length === 0 && (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* 6. Execution History (view/edit mode only)                       */}
          {/* =============================================================== */}
          {(isViewMode || isEditMode) && skillSet && (
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t.executionHistory}</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t.lastExecutedAt}</span>
                  <span className="text-foreground">
                    {skillSet.lastExecutedAt
                      ? formatDateTime(skillSet.lastExecutedAt, locale)
                      : t.notExecuted}
                  </span>
                </div>
                {skillSet.executionResult && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t.executionResult}</span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(skillSet.executionResult.status)}
                      <span className="text-xs text-muted-foreground">
                        {truncate(skillSet.executionResult.message, 50)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 7. Footer                                                         */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          {/* Left side: Delete button */}
          <div>
            {isEditMode && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive">{t.deleteConfirm}</span>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-destructive hover:bg-destructive/90 rounded-md transition-colors"
                    >
                      {t.deleteConfirmYes}
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t.deleteConfirmNo}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-3 py-1.5 text-sm font-medium text-destructive hover:text-destructive/80 border border-destructive/30 rounded-md hover:bg-destructive/5 transition-colors"
                  >
                    {t.delete}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right side: Cancel, Save, Execute */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="
                px-4 py-2 text-sm font-medium
                text-muted-foreground hover:text-foreground
                bg-muted hover:bg-muted/80
                rounded-md transition-colors
              "
            >
              {t.cancel}
            </button>

            {(isCreateMode || isEditMode) && (
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="
                  px-4 py-2 text-sm font-medium text-white
                  bg-primary hover:bg-primary/90
                  disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
                  rounded-md transition-colors
                "
              >
                {isSaving ? t.saving : t.save}
              </button>
            )}

            {(isViewMode || isEditMode) && onExecute && (
              <div className="relative group">
                <button
                  onClick={handleExecute}
                  disabled={!isRemoteCliConnected || !selectedNoteId}
                  className="
                    px-4 py-2 text-sm font-medium text-white
                    bg-green-600 hover:bg-green-700
                    disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed
                    rounded-md transition-colors
                  "
                >
                  {t.execute}
                </button>
                {(!isRemoteCliConnected || !selectedNoteId) && (
                  <div className="
                    absolute bottom-full right-0 mb-2
                    px-2 py-1 text-xs text-white bg-gray-800 rounded
                    opacity-0 group-hover:opacity-100 transition-opacity
                    pointer-events-none whitespace-nowrap
                  ">
                    {!isRemoteCliConnected ? t.remoteCliNotConnected : t.selectNote}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillSetModal;
