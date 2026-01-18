/**
 * useMindmapPersistence Hook
 * 
 * Handles save and close operations for the mindmap.
 * Manages unsaved changes detection and confirmation dialogs.
 */

import { useCallback, useMemo } from 'react';
import { Node, Edge } from 'reactflow';
import type { MindmapSavePayload } from '../types/mindmap.types';

/** Props for the hook */
interface UseMindmapPersistenceProps {
  /** Current mindmap data */
  mindmap?: { id?: string; name?: string } | null;
  /** Current mindmap name */
  mindmapName: string;
  /** All nodes */
  nodes: Node[];
  /** All edges */
  edges: Edge[];
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Setter for unsaved changes flag */
  setHasUnsavedChanges: (value: boolean) => void;
  /** Setter for save dialog visibility */
  setShowSaveDialog: (value: boolean) => void;
  /** Save callback from parent */
  onSave?: (data: MindmapSavePayload) => void;
  /** Close callback from parent */
  onClose: () => void;
  /** Show toast message */
  showToast: (config: { message: string; duration?: number }) => void;
  /** Translation function */
  t: (key: string) => string;
}

/** Return type for the hook */
interface UseMindmapPersistenceReturn {
  /** Handle save operation */
  handleSave: () => void;
  /** Handle close with unsaved changes check */
  handleClose: () => void;
  /** Handle save and close */
  handleSaveAndClose: () => void;
  /** Handle close without saving */
  handleCloseWithoutSaving: () => void;
  /** Handle cancel close dialog */
  handleCancelClose: () => void;
  /** Serialized mindmap data for saving */
  mindmapData: MindmapSavePayload;
}

/**
 * Custom hook for handling mindmap persistence operations.
 * 
 * @param props - Hook configuration
 * @returns Persistence handlers and data
 */
export function useMindmapPersistence({
  mindmap,
  mindmapName,
  nodes,
  edges,
  hasUnsavedChanges,
  setHasUnsavedChanges,
  setShowSaveDialog,
  onSave,
  onClose,
  showToast,
  t,
}: UseMindmapPersistenceProps): UseMindmapPersistenceReturn {
  
  /**
   * Serializes mindmap data for saving.
   */
  const mindmapData = useMemo<MindmapSavePayload>(() => ({
    id: mindmap?.id,
    name: mindmapName,
    nodes: nodes.map(node => ({
      id: node.id,
      label: node.data.label,
      x: node.position.x,
      y: node.position.y,
      nodeType: (node.data.nodeType || 'default') as 'default' | 'habit' | 'goal',
      habitId: node.data.habitId,
      goalId: node.data.goalId,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.data as Record<string, unknown> | undefined,
    })),
  }), [mindmap?.id, mindmapName, nodes, edges]);

  /**
   * Handles save operation.
   */
  const handleSave = useCallback(() => {
    try {
      if (onSave) {
        onSave(mindmapData);
        setHasUnsavedChanges(false);
        showToast({ message: t('saved'), duration: 1500 });
      }
    } catch (error) {
      console.error('[Mindmap] Save failed:', error);
    }
  }, [mindmapData, onSave, setHasUnsavedChanges, showToast, t]);

  /**
   * Handles close with unsaved changes check.
   */
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowSaveDialog(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, setShowSaveDialog, onClose]);

  /**
   * Handles save and close.
   */
  const handleSaveAndClose = useCallback(() => {
    handleSave();
    setShowSaveDialog(false);
    onClose();
  }, [handleSave, setShowSaveDialog, onClose]);

  /**
   * Handles close without saving.
   */
  const handleCloseWithoutSaving = useCallback(() => {
    setShowSaveDialog(false);
    onClose();
  }, [setShowSaveDialog, onClose]);

  /**
   * Handles cancel close dialog.
   */
  const handleCancelClose = useCallback(() => {
    setShowSaveDialog(false);
  }, [setShowSaveDialog]);

  return {
    handleSave,
    handleClose,
    handleSaveAndClose,
    handleCloseWithoutSaving,
    handleCancelClose,
    mindmapData,
  };
}
