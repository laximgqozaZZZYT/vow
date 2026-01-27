/**
 * Widget.Mindmap - Refactored Version
 * 
 * Main mindmap component with improved code organization.
 * Uses extracted hooks and components for better maintainability.
 */

import React, { useCallback, useRef, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  OnSelectionChangeParams,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

// Modals
import { GoalModal } from './Modal.Goal';
import { HabitModal } from './Modal.Habit';
import { ToastProvider, useToast } from './ToastManager';

// Custom node types
import { customNodeTypes } from './Mindmap.Node';

// Hooks
import { useMindmapState } from '../hooks/useMindmapState';
import { useConnectionMode } from '../hooks/useConnectionMode';
import { useMobileInteractions } from '../hooks/useMobileInteractions';
import { useNodeOperations } from '../hooks/useNodeOperations';
import { useMindmapModals } from '../hooks/useMindmapModals';
import { useMindmapEvents } from '../hooks/useMindmapEvents';
import { useConnectionHandlers } from '../hooks/useConnectionHandlers';
import { useMindmapPersistence } from '../hooks/useMindmapPersistence';
import { useModalHandlers } from '../hooks/useModalHandlers';

// UI Components
import {
  MindmapHeader,
  MindmapControls,
  EdgeLegend,
  ConnectionModeOverlay,
  MobileBottomMenu,
  SaveDialog,
  CoachMark,
  hasSeenCoachMark,
} from './Mindmap.Components';

// Types
import { MindmapProps, CustomNodeData } from '../types/mindmap.types';

// Utilities
import {
  isMobileDevice,
  calculateNewNodePosition,
} from '../../../lib/mindmap.utils';
import { getTranslation } from '../../../lib/mindmap.i18n';
import { initializeMindmapTestHandler } from '../../../lib/mindmap.test-handler';
import { isAnyNodeEditing } from '../../../lib/mindmap';

// Initialize test handler
if (typeof window !== 'undefined') {
  initializeMindmapTestHandler();
}

/**
 * Main mindmap flow component.
 */
function MindmapFlow({
  onClose,
  onRegisterAsHabit,
  onRegisterAsGoal,
  goals = [],
  habits = [],
  mindmap,
  onSave,
}: MindmapProps) {
  // Core state from useMindmapState
  const state = useMindmapState(mindmap, goals);
  const {
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedNodes, setSelectedNodes,
    showSaveDialog, setShowSaveDialog,
    showCoachMark, setShowCoachMark,
    lang, setLang,
    hasUnsavedChanges, setHasUnsavedChanges,
    setIsLongPressMode,
    mindmapName, setMindmapName,
    isEditMode,
  } = state;

  // Translation function - memoized
  const t = useMemo(() => getTranslation(lang), [lang]);

  // Toast context
  const toastCtx = (() => {
    try {
      return useToast();
    } catch {
      return null;
    }
  })();

  // Refs
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // React Flow hooks
  const { project, getViewport } = useReactFlow();

  // Device detection - memoized
  const isMobile = useMemo(() => isMobileDevice(), []);

  // Mark changes callback
  const markChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, [setHasUnsavedChanges]);

  // Show toast callback
  const showToast = useCallback((config: { message: string; duration?: number }) => {
    toastCtx?.showToast(config);
  }, [toastCtx]);

  // Connection mode hook
  const {
    connectionMode,
    startConnection,
    endConnection,
    executeConnection,
    isConnectionActive,
    sourceNode: connectionSourceNode,
  } = useConnectionMode({
    nodes,
    edges,
    setEdges,
    goals,
    onShowToast: showToast,
    onChangesMade: markChanges,
  });

  // Modal management hook
  const {
    modalState,
    openHabitModal,
    openGoalModal,
    closeModal,
  } = useMindmapModals({ goals, habits });

  // Node operations hook
  const {
    createNode,
    deleteSelectedNodes,
    setNodeType,
    setNodeEditing,
    clearEditing,
  } = useNodeOperations({
    nodes,
    setNodes,
    edges,
    setEdges,
    onChangesMade: markChanges,
    isEditMode,
  });

  // Mobile interactions hook
  const {
    mobileBottomMenu,
    showBottomMenu,
    hideBottomMenu,
    handleMenuAction,
  } = useMobileInteractions({
    nodes,
    setNodes,
    edges,
    setEdges,
    startConnection,
    openModal: (type, nodeId, nodeName) => {
      if (type === 'habit') {
        openHabitModal(nodeId, nodeName);
      } else {
        openGoalModal(nodeId, nodeName);
      }
    },
    onChangesMade: markChanges,
    isEditMode,
  });

  // Connection handlers hook
  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    handleMobileNodeTap,
    handlePaneClick: baseHandlePaneClick,
  } = useConnectionHandlers({
    nodes,
    edges,
    setEdges,
    connectionMode,
    startConnection,
    endConnection,
    isConnectionActive,
    executeConnection,
    createNode,
    setNodeEditing,
    openGoalModal,
    openHabitModal,
    showToast,
    markChanges,
    goals,
    habits,
    isMobile,
    project,
    getViewport,
    reactFlowWrapper,
  });

  // Persistence handlers hook
  const {
    handleSave,
    handleClose,
    handleSaveAndClose,
    handleCloseWithoutSaving,
    handleCancelClose,
  } = useMindmapPersistence({
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
  });

  // Modal handlers hook
  const {
    handleHabitCreate,
    handleGoalCreate,
  } = useModalHandlers({
    modalState,
    onRegisterAsHabit,
    onRegisterAsGoal,
    setNodeType,
    closeModal,
  });

  // Set edit mode globally for custom nodes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__mindmapEditMode = isEditMode;
    }
  }, [isEditMode]);

  // Initialize coach mark
  useEffect(() => {
    if (!hasSeenCoachMark()) {
      setShowCoachMark(true);
    }
  }, [setShowCoachMark]);

  // Check if any node is editing - memoized
  const anyNodeEditing = useMemo(() => isAnyNodeEditing(nodes), [nodes]);

  // Event handlers for useMindmapEvents - memoized
  const eventHandlers = useMemo(() => ({
    onNodeChanged: markChanges,
    onLongPressStart: () => setIsLongPressMode(true),
    onLongPressEnd: () => setIsLongPressMode(false),
    onShowMobileBottomMenu: showBottomMenu,
    onStartMobileConnection: (sourceNodeId: string, sourceHandleId?: string) => {
      startConnection(sourceNodeId, sourceHandleId);
      hideBottomMenu();
    },
    onGetConnectionModeState: () => connectionMode,
    onExecuteConnection: (targetNodeId: string) => {
      if (isConnectionActive) {
        executeConnection(targetNodeId);
      }
    },
  }), [
    markChanges,
    setIsLongPressMode,
    showBottomMenu,
    startConnection,
    hideBottomMenu,
    connectionMode,
    isConnectionActive,
    executeConnection,
  ]);

  // Use mindmap events hook
  useMindmapEvents({
    isMobile,
    isEditMode,
    isAnyNodeEditing: anyNodeEditing,
    selectedNodes,
    connectionMode,
    handlers: eventHandlers,
    onDeleteKey: () => deleteSelectedNodes(selectedNodes),
    onEscapeKey: () => {
      if (isConnectionActive) {
        endConnection();
      }
      clearEditing();
    },
  });

  /**
   * Adds a new node at the center of the viewport.
   */
  const addNodeAtCenter = useCallback(() => {
    if (!isEditMode) return;

    const viewport = getViewport();
    const position = calculateNewNodePosition(viewport, isMobile);

    createNode({ position, startEditing: false });
  }, [isEditMode, getViewport, isMobile, createNode]);

  /**
   * Handles selection change.
   */
  const onSelectionChange = useCallback(({ nodes: selectedNodesList }: OnSelectionChangeParams) => {
    setSelectedNodes(selectedNodesList as Node<CustomNodeData>[]);
  }, [setSelectedNodes]);

  /**
   * Clears all connections.
   */
  const clearAllConnections = useCallback(() => {
    if (!isEditMode) return;
    setEdges([]);
    markChanges();
  }, [isEditMode, setEdges, markChanges]);

  /**
   * Handles pane click - hides mobile menu and delegates to connection handler.
   */
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (isMobile) {
      hideBottomMenu();
    }
    baseHandlePaneClick(event);
  }, [isMobile, hideBottomMenu, baseHandlePaneClick]);

  // Get source node name for connection overlay - memoized
  const sourceNodeName = useMemo(() => 
    connectionSourceNode?.data.label || 'Unknown',
    [connectionSourceNode]
  );

  // Get current node type for mobile menu - memoized
  const currentNodeType = useMemo(() => {
    const node = nodes.find(n => n.id === mobileBottomMenu.nodeId);
    return node?.data.nodeType || 'default';
  }, [nodes, mobileBottomMenu.nodeId]);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900">
      {/* Header */}
      <MindmapHeader
        mindmapName={mindmapName}
        hasUnsavedChanges={hasUnsavedChanges}
        lang={lang}
        originalName={mindmap?.name}
        onNameChange={setMindmapName}
        onSave={handleSave}
        onClose={handleClose}
        onLanguageToggle={() => setLang(lang === 'ja' ? 'en' : 'ja')}
        onChangesMade={markChanges}
      />

      {/* React Flow Container */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={isEditMode ? onNodesChange : undefined}
          onEdgesChange={isEditMode ? onEdgesChange : undefined}
          onConnect={isEditMode ? onConnect : undefined}
          onConnectStart={isEditMode ? (onConnectStart as any) : undefined}
          onConnectEnd={isEditMode ? (onConnectEnd as any) : undefined}
          onSelectionChange={onSelectionChange}
          onNodeClick={isMobile ? (_event, node) => {
            if (isConnectionActive) {
              handleMobileNodeTap(node.id);
            }
          } : undefined}
          nodeTypes={customNodeTypes}
          nodesDraggable={isEditMode}
          nodesConnectable={isEditMode}
          elementsSelectable={isEditMode}
          selectNodesOnDrag={isEditMode}
          panOnDrag={isMobile ? [1] : [1, 2]}
          fitView
          attributionPosition="bottom-left"
          className="bg-gray-50 dark:bg-gray-800"
          minZoom={isMobile ? 0.3 : 0.5}
          maxZoom={isMobile ? 2 : 4}
          onPaneClick={handlePaneClick}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

          {/* Controls Panel */}
          <Panel position="bottom-left" className="flex flex-col gap-2 m-2 sm:m-4">
            <MindmapControls
              isEditMode={isEditMode}
              selectedNodesCount={selectedNodes.length}
              isMobile={isMobile}
              lang={lang}
              onAddNode={addNodeAtCenter}
              onClearConnections={clearAllConnections}
              onDeleteSelected={() => deleteSelectedNodes(selectedNodes)}
            />
          </Panel>

          {/* Edge Legend */}
          <Panel position="top-right" className="m-2 sm:m-4">
            <EdgeLegend lang={lang} />
          </Panel>
        </ReactFlow>
      </div>

      {/* Save Dialog */}
      <SaveDialog
        isVisible={showSaveDialog}
        lang={lang}
        onCancel={handleCancelClose}
        onDontSave={handleCloseWithoutSaving}
        onSaveAndClose={handleSaveAndClose}
      />

      {/* Mobile Bottom Menu */}
      {isMobile && isEditMode && (
        <MobileBottomMenu
          isVisible={mobileBottomMenu.isVisible}
          nodeId={mobileBottomMenu.nodeId}
          nodeName={mobileBottomMenu.nodeName}
          nodeType={currentNodeType}
          lang={lang}
          onAction={handleMenuAction}
          onClose={hideBottomMenu}
        />
      )}

      {/* Connection Mode Overlay */}
      {isMobile && (
        <ConnectionModeOverlay
          isActive={isConnectionActive}
          sourceNodeName={sourceNodeName}
          lang={lang}
          onCancel={endConnection}
        />
      )}

      {/* Habit Modal */}
      <HabitModal
        open={modalState.habitModal}
        onClose={closeModal}
        habit={null}
        initial={{
          date: new Date().toISOString().slice(0, 10),
          goalId: (window as any).__mindmapNewNodeGoalId || (goals.length > 0 ? goals[0].id : undefined),
          relatedHabitIds: (window as any).__mindmapNewNodeRelatedHabitIds,
        }}
        onCreate={handleHabitCreate}
        categories={goals}
      />

      {/* Goal Modal */}
      <GoalModal
        open={modalState.goalModal}
        onClose={closeModal}
        goal={null}
        initial={{
          name: modalState.selectedNodeName,
          parentId: (window as any).__mindmapNewNodeParentGoalId || null,
        }}
        onCreate={handleGoalCreate}
        goals={goals}
        habits={habits}
      />

      {/* Coach Mark */}
      <CoachMark
        isVisible={showCoachMark}
        lang={lang}
        onDismiss={() => setShowCoachMark(false)}
      />
    </div>
  );
}

/**
 * Main export with providers.
 */
export default function WidgetMindmapRefactored(props: MindmapProps) {
  return (
    <ToastProvider>
      <ReactFlowProvider>
        <MindmapFlow {...props} />
      </ReactFlowProvider>
    </ToastProvider>
  );
}
