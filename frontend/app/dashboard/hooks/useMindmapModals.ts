/**
 * useMindmapModals Hook
 * 
 * Manages modal state for habit and goal registration in the mindmap.
 * Handles opening, closing, and state management for registration modals.
 * 
 * @example
 * const {
 *   modalState,
 *   openHabitModal,
 *   openGoalModal,
 *   closeModal,
 *   isAnyModalOpen
 * } = useMindmapModals();
 */

import { useState, useCallback, useEffect } from 'react';
import { ModalState } from '../types/mindmap.types';

/** Initial modal state */
const INITIAL_MODAL_STATE: ModalState = {
  habitModal: false,
  goalModal: false,
  selectedNodeName: '',
  selectedNodeId: '',
};

/** Global window properties for passing data to modals */
interface MindmapGlobalState {
  __mindmapNewNodeGoalId?: string;
  __mindmapNewNodeRelatedHabitIds?: string[];
  __mindmapNewNodeParentGoalId?: string;
}

/** Hook configuration options */
export interface UseMindmapModalsOptions {
  /** Goals for parent selection */
  goals?: { id: string; name: string }[];
  /** Habits for relation selection */
  habits?: { id: string; name: string }[];
}

/** Return type for the hook */
export interface UseMindmapModalsReturn {
  /** Current modal state */
  modalState: ModalState;
  /** Open the habit registration modal */
  openHabitModal: (nodeId: string, nodeName: string, options?: OpenHabitModalOptions) => void;
  /** Open the goal registration modal */
  openGoalModal: (nodeId: string, nodeName: string, options?: OpenGoalModalOptions) => void;
  /** Close any open modal */
  closeModal: () => void;
  /** Check if any modal is open */
  isAnyModalOpen: boolean;
  /** Set modal state directly */
  setModalState: React.Dispatch<React.SetStateAction<ModalState>>;
}

/** Options for opening habit modal */
export interface OpenHabitModalOptions {
  /** Goal ID to associate with the habit */
  goalId?: string;
  /** Related habit IDs */
  relatedHabitIds?: string[];
}

/** Options for opening goal modal */
export interface OpenGoalModalOptions {
  /** Parent goal ID */
  parentGoalId?: string;
}

/**
 * Custom hook for managing mindmap modals.
 * 
 * @param options - Hook configuration options
 * @returns Modal state and control functions
 */
export function useMindmapModals(options: UseMindmapModalsOptions = {}): UseMindmapModalsReturn {
  const { goals = [], habits = [] } = options;

  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);

  /**
   * Opens the habit registration modal.
   * 
   * @param nodeId - ID of the node to register as habit
   * @param nodeName - Name of the node
   * @param options - Additional options
   */
  const openHabitModal = useCallback((
    nodeId: string,
    nodeName: string,
    modalOptions?: OpenHabitModalOptions
  ) => {
    // Set global state for modal to access
    if (typeof window !== 'undefined') {
      const win = window as unknown as MindmapGlobalState;
      if (modalOptions?.goalId) {
        win.__mindmapNewNodeGoalId = modalOptions.goalId;
      }
      if (modalOptions?.relatedHabitIds) {
        win.__mindmapNewNodeRelatedHabitIds = modalOptions.relatedHabitIds;
      }
    }

    setModalState({
      habitModal: true,
      goalModal: false,
      selectedNodeName: nodeName,
      selectedNodeId: nodeId,
    });
  }, []);

  /**
   * Opens the goal registration modal.
   * 
   * @param nodeId - ID of the node to register as goal
   * @param nodeName - Name of the node
   * @param options - Additional options
   */
  const openGoalModal = useCallback((
    nodeId: string,
    nodeName: string,
    modalOptions?: OpenGoalModalOptions
  ) => {
    // Set global state for modal to access
    if (typeof window !== 'undefined') {
      const win = window as unknown as MindmapGlobalState;
      if (modalOptions?.parentGoalId) {
        win.__mindmapNewNodeParentGoalId = modalOptions.parentGoalId;
      }
    }

    setModalState({
      habitModal: false,
      goalModal: true,
      selectedNodeName: nodeName,
      selectedNodeId: nodeId,
    });
  }, []);

  /**
   * Closes any open modal and clears global state.
   */
  const closeModal = useCallback(() => {
    // Clear global state
    if (typeof window !== 'undefined') {
      const win = window as unknown as MindmapGlobalState;
      delete win.__mindmapNewNodeGoalId;
      delete win.__mindmapNewNodeRelatedHabitIds;
      delete win.__mindmapNewNodeParentGoalId;
    }

    setModalState(INITIAL_MODAL_STATE);
  }, []);

  /**
   * Check if any modal is currently open.
   */
  const isAnyModalOpen = modalState.habitModal || modalState.goalModal;

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (isAnyModalOpen && modalState.selectedNodeName) {
      // Delay to allow modal to render
      const timeoutId = setTimeout(() => {
        const nameInput = document.querySelector(
          'input[placeholder="Add title"], input[placeholder="Goal name"]'
        ) as HTMLInputElement;
        
        if (nameInput) {
          nameInput.value = modalState.selectedNodeName;
          nameInput.focus();
          nameInput.select();
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isAnyModalOpen, modalState.selectedNodeName]);

  return {
    modalState,
    openHabitModal,
    openGoalModal,
    closeModal,
    isAnyModalOpen,
    setModalState,
  };
}

export default useMindmapModals;
