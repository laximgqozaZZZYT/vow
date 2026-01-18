/**
 * useModalHandlers Hook
 * 
 * Handles modal-related operations for habit and goal creation.
 * Manages the flow from modal submission to node type update.
 */

import { useCallback } from 'react';
import type { RegisterHabitData, RegisterGoalData } from '../types/mindmap.types';

/** Modal state */
interface ModalState {
  habitModal: boolean;
  goalModal: boolean;
  selectedNodeName: string;
  selectedNodeId: string;
}

/** Props for the hook */
interface UseModalHandlersProps {
  /** Current modal state */
  modalState: ModalState;
  /** Register habit callback from parent */
  onRegisterAsHabit: (payload: RegisterHabitData) => Promise<{ id: string; name: string } | null>;
  /** Register goal callback from parent */
  onRegisterAsGoal: (payload: RegisterGoalData) => Promise<{ id: string; name: string } | null>;
  /** Set node type after creation */
  setNodeType: (nodeId: string, type: 'habit' | 'goal', entityId?: string) => void;
  /** Close modal */
  closeModal: () => void;
}

/** Return type for the hook */
interface UseModalHandlersReturn {
  /** Handle habit creation from modal */
  handleHabitCreate: (payload: RegisterHabitData) => Promise<void>;
  /** Handle goal creation from modal */
  handleGoalCreate: (payload: RegisterGoalData) => Promise<void>;
}

/**
 * Custom hook for handling modal operations.
 * 
 * @param props - Hook configuration
 * @returns Modal handlers
 */
export function useModalHandlers({
  modalState,
  onRegisterAsHabit,
  onRegisterAsGoal,
  setNodeType,
  closeModal,
}: UseModalHandlersProps): UseModalHandlersReturn {
  
  /**
   * Handles habit creation from modal.
   * Updates the node type after successful creation.
   */
  const handleHabitCreate = useCallback(async (payload: RegisterHabitData) => {
    try {
      const createdHabit = await onRegisterAsHabit({
        ...payload,
        name: modalState.selectedNodeName || payload.name,
      });

      setNodeType(modalState.selectedNodeId, 'habit', createdHabit?.id);
      closeModal();
    } catch (error) {
      console.error('[Mindmap] Failed to create habit:', error);
    }
  }, [modalState, onRegisterAsHabit, setNodeType, closeModal]);

  /**
   * Handles goal creation from modal.
   * Updates the node type after successful creation.
   */
  const handleGoalCreate = useCallback(async (payload: RegisterGoalData) => {
    try {
      const createdGoal = await onRegisterAsGoal({
        ...payload,
        name: modalState.selectedNodeName || payload.name,
      });

      setNodeType(modalState.selectedNodeId, 'goal', createdGoal?.id);
      closeModal();
    } catch (error) {
      console.error('[Mindmap] Failed to create goal:', error);
    }
  }, [modalState, onRegisterAsGoal, setNodeType, closeModal]);

  return {
    handleHabitCreate,
    handleGoalCreate,
  };
}
