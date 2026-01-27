/**
 * Widget.EditableMindmap - Refactored Version
 * 
 * Mindmap component for editing existing habits and goals.
 * Uses extracted hooks and components for better maintainability.
 */

"use client"

import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Node,
  Background,
  BackgroundVariant,
  Panel,
  ReactFlowProvider,
  MarkerType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { supabaseDirectClient } from '../../../lib/supabase-direct';
import type { Habit, Goal } from '../types';

// Extracted components
import { editableNodeTypes, GoalNodeData, HabitNodeData } from './EditableMindmap.Nodes';
import { ControlsPanel } from './EditableMindmap.Controls';
import { DetailPanel } from './EditableMindmap.DetailPanel';

// Hooks
import { useEditableMindmapState } from '../hooks/useEditableMindmapState';

/** Props for EditableMindmap component */
interface EditableMindmapProps {
  habits: Habit[];
  goals: Goal[];
  onClose: () => void;
  onRegisterAsHabit: (data: any) => Promise<any>;
  onRegisterAsGoal: (data: any) => Promise<any>;
}

/**
 * Main EditableMindmap flow component.
 */
function EditableMindmapFlow({ 
  habits, 
  goals, 
  onClose, 
  onRegisterAsHabit, 
  onRegisterAsGoal 
}: EditableMindmapProps) {
  // State from custom hook
  const {
    flowNodes,
    setFlowNodes,
    onNodesChange,
    flowEdges,
    setFlowEdges,
    onEdgesChange,
    selectedNode,
    setSelectedNode,
    nodeType,
    setNodeType,
    isEditing,
    setIsEditing,
    detailViewMode,
    setDetailViewMode,
    zoomLevel,
    setZoomLevel,
    connectionStartInfo,
    setConnectionStartInfo,
  } = useEditableMindmapState({ habits, goals });

  // Local state
  const [tags, setTags] = useState<any[]>([]);
  
  // Refs
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // React Flow hooks
  const { project, fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      const allTags = await supabaseDirectClient.getTags();
      setTags(Array.isArray(allTags) ? allTags : []);
    } catch (err) {
      console.error('[EditableMindmap] loadTags error', err);
    }
  }

  // Update zoom level from viewport
  useEffect(() => {
    const updateZoom = () => {
      const viewport = getViewport();
      setZoomLevel(viewport.zoom);
    };
    
    updateZoom();
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [getViewport, setZoomLevel]);

  /**
   * Handles node double-click for inline editing.
   */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, isEditing: true } }
            : { ...n, data: { ...n.data, isEditing: false } }
        )
      );
    },
    [setFlowNodes]
  );

  /**
   * Handles node click for selection.
   */
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setIsEditing(false);
    },
    [setSelectedNode, setIsEditing]
  );

  /**
   * Handles connection start.
   */
  const onConnectStart = useCallback(
    (_event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string; handleId?: string }) => {
      setConnectionStartInfo({ nodeId, handleId });
    },
    [setConnectionStartInfo]
  );

  /**
   * Handles connection end - creates new node if dropped on empty space.
   */
  const onConnectEnd = useCallback(
    async (event: MouseEvent | TouchEvent) => {
      if (!connectionStartInfo) return;
      
      const target = event.target as Element;
      const targetIsPane = target?.classList.contains('react-flow__pane');
      
      if (targetIsPane && reactFlowWrapper.current) {
        const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
        const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
        const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
        
        const position = project({
          x: clientX - reactFlowBounds.left,
          y: clientY - reactFlowBounds.top,
        });

        const sourceNode = flowNodes.find(n => n.id === connectionStartInfo.nodeId);
        const sourceNodeType = sourceNode?.type;
        
        if (sourceNodeType === 'goalNode') {
          await handleGoalNodeConnection(sourceNode, position);
        } else if (sourceNodeType === 'habitNode') {
          await handleHabitNodeConnection(sourceNode, position);
        }
      }
      
      setConnectionStartInfo(null);
    },
    [connectionStartInfo, project, flowNodes, nodeType, setConnectionStartInfo]
  );

  /**
   * Creates a new node connected from a goal node.
   */
  const handleGoalNodeConnection = async (sourceNode: Node | undefined, position: { x: number; y: number }) => {
    if (!sourceNode) return;
    
    const sourceGoalData = sourceNode.data as GoalNodeData;
    const sourceGoalId = sourceGoalData?.goal?.id;
    
    if (nodeType === 'goal') {
      // Create new goal as child
      const newGoalPayload = {
        name: 'New Goal',
        parentId: sourceGoalId,
      };
      
      const createdGoal = await onRegisterAsGoal(newGoalPayload);
      
      const newNode: Node = {
        id: `goal-${createdGoal.id}`,
        position,
        data: { 
          goal: createdGoal,
          habitCount: 0,
          completedHabitCount: 0,
          label: createdGoal.name, 
          isEditing: false,
        },
        type: 'goalNode',
      };
      
      setFlowNodes((nds) => nds.concat(newNode));
      
      const newEdge = {
        id: `edge-${connectionStartInfo?.nodeId}-${newNode.id}`,
        source: connectionStartInfo?.nodeId || '',
        target: newNode.id,
        style: { stroke: '#9333ea', strokeWidth: 3 },
        type: 'step',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#9333ea',
        },
      };
      
      setFlowEdges((eds) => eds.concat(newEdge));
    } else {
      // Create new habit under goal
      const newHabitPayload = {
        name: 'New Habit',
        goalId: sourceGoalId,
        type: 'do',
        must: 1,
      };
      
      const createdHabit = await onRegisterAsHabit(newHabitPayload);
      
      const newNode: Node = {
        id: `habit-${createdHabit.id}`,
        position,
        data: { 
          habit: createdHabit,
          goal: sourceGoalData.goal,
          progressPercentage: 0,
          label: createdHabit.name, 
          isEditing: false,
        },
        type: 'habitNode',
      };
      
      setFlowNodes((nds) => nds.concat(newNode));
      
      const newEdge = {
        id: `edge-${connectionStartInfo?.nodeId}-${newNode.id}`,
        source: connectionStartInfo?.nodeId || '',
        target: newNode.id,
        style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
        type: 'step',
      };
      
      setFlowEdges((eds) => eds.concat(newEdge));
    }
  };

  /**
   * Creates a new habit connected from a habit node.
   */
  const handleHabitNodeConnection = async (sourceNode: Node | undefined, position: { x: number; y: number }) => {
    if (!sourceNode || nodeType !== 'habit') return;
    
    const sourceHabitData = sourceNode.data as HabitNodeData;
    const sourceHabitId = sourceHabitData?.habit?.id;
    const sourceGoalId = sourceHabitData?.habit?.goalId;
    
    const newHabitPayload = {
      name: 'New Habit',
      goalId: sourceGoalId,
      type: 'do',
      must: 1,
    };
    
    const createdHabit = await onRegisterAsHabit(newHabitPayload);
    
    // Create habit relation
    try {
      await supabaseDirectClient.createHabitRelation({
        habitId: sourceHabitId,
        relatedHabitId: createdHabit.id,
        relation: 'next',
      });
    } catch (error) {
      console.error('[EditableMindmap] Failed to create habit relation:', error);
    }
    
    const newNode: Node = {
      id: `habit-${createdHabit.id}`,
      position,
      data: { 
        habit: createdHabit,
        goal: sourceHabitData.goal,
        progressPercentage: 0,
        label: createdHabit.name, 
        isEditing: false,
      },
      type: 'habitNode',
    };
    
    setFlowNodes((nds) => nds.concat(newNode));
    
    const newEdge = {
      id: `edge-${connectionStartInfo?.nodeId}-${newNode.id}`,
      source: connectionStartInfo?.nodeId || '',
      target: newNode.id,
      style: { stroke: '#10b981', strokeWidth: 2 },
      type: 'step',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#10b981',
      },
    };
    
    setFlowEdges((eds) => eds.concat(newEdge));
  };

  /**
   * Handles node deletion.
   */
  const handleDelete = useCallback(async () => {
    if (!selectedNode) return;
    
    const confirmed = window.confirm(
      selectedNode.type === 'goalNode'
        ? 'Delete this Goal? All child Goals and Habits will also be deleted.'
        : 'Delete this Habit?'
    );
    
    if (!confirmed) return;
    
    try {
      if (selectedNode.type === 'goalNode') {
        const goalNodeData = selectedNode.data as GoalNodeData;
        const goalId = goalNodeData.goal.id;
        
        // Find all child goals recursively
        const findChildGoals = (parentId: string): string[] => {
          const children = goals.filter(g => g.parentId === parentId);
          const childIds = children.map(c => c.id);
          const grandChildIds = children.flatMap(c => findChildGoals(c.id));
          return [...childIds, ...grandChildIds];
        };
        
        const allGoalIdsToDelete = [goalId, ...findChildGoals(goalId)];
        const habitsToDelete = habits.filter(h => allGoalIdsToDelete.includes(h.goalId));
        
        // Delete all habits first
        for (const habit of habitsToDelete) {
          await supabaseDirectClient.deleteHabit(habit.id);
        }
        
        // Delete all goals
        for (const gId of allGoalIdsToDelete) {
          await supabaseDirectClient.deleteGoal(gId);
        }
        
        // Remove nodes and edges from UI
        const nodeIdsToRemove = [
          ...allGoalIdsToDelete.map(id => `goal-${id}`),
          ...habitsToDelete.map(h => `habit-${h.id}`)
        ];
        
        setFlowNodes((nds) => nds.filter(n => !nodeIdsToRemove.includes(n.id)));
        setFlowEdges((eds) => eds.filter(e => 
          !nodeIdsToRemove.includes(e.source) && !nodeIdsToRemove.includes(e.target)
        ));
        
      } else if (selectedNode.type === 'habitNode') {
        const habitNodeData = selectedNode.data as HabitNodeData;
        const habitId = habitNodeData.habit.id;
        
        await supabaseDirectClient.deleteHabit(habitId);
        
        setFlowNodes((nds) => nds.filter(n => n.id !== selectedNode.id));
        setFlowEdges((eds) => eds.filter(e => 
          e.source !== selectedNode.id && e.target !== selectedNode.id
        ));
      }
      
      setSelectedNode(null);
      setIsEditing(false);
      
    } catch (error) {
      console.error('[EditableMindmap] Failed to delete:', error);
      alert('Failed to delete. Please try again.');
    }
  }, [selectedNode, goals, habits, setFlowNodes, setFlowEdges, setSelectedNode, setIsEditing]);

  /**
   * Handles habit form save.
   */
  const handleHabitSave = useCallback(async (habitData: any) => {
    if (!selectedNode || selectedNode.type !== 'habitNode') return;
    
    const habitNodeData = selectedNode.data as HabitNodeData;
    const habitId = habitNodeData.habit.id;
    
    try {
      await supabaseDirectClient.updateHabit(habitId, habitData);
      
      const updatedHabit = {
        ...habitNodeData.habit,
        ...habitData,
      };
      
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, habit: updatedHabit, label: updatedHabit.name } }
            : n
        )
      );
    } catch (error) {
      console.error('[EditableMindmap] Failed to update habit:', error);
    }
  }, [selectedNode, setFlowNodes]);

  /**
   * Handles goal form save.
   */
  const handleGoalSave = useCallback(async (goalData: any) => {
    if (!selectedNode || selectedNode.type !== 'goalNode') return;
    
    const goalNodeData = selectedNode.data as GoalNodeData;
    const goalId = goalNodeData.goal.id;
    
    try {
      await supabaseDirectClient.updateGoal(goalId, goalData);
      
      const updatedGoal = {
        ...goalNodeData.goal,
        ...goalData,
      };
      
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id
            ? { ...n, data: { ...n.data, goal: updatedGoal, label: updatedGoal.name } }
            : n
        )
      );
    } catch (error) {
      console.error('[EditableMindmap] Failed to update goal:', error);
    }
  }, [selectedNode, setFlowNodes]);

  /**
   * Handles zoom slider change.
   */
  const handleZoomChange = useCallback((zoom: number) => {
    setZoomLevel(zoom);
    const viewport = getViewport();
    setViewport({ ...viewport, zoom });
  }, [setZoomLevel, getViewport, setViewport]);

  /**
   * Closes the detail panel.
   */
  const closeDetailPanel = useCallback(() => {
    setSelectedNode(null);
    setIsEditing(false);
  }, [setSelectedNode, setIsEditing]);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Edit Mindmap
        </h2>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Close
        </button>
      </div>

      {/* React Flow Container */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnectStart={onConnectStart as any}
          onConnectEnd={onConnectEnd as any}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          nodeTypes={editableNodeTypes}
          defaultViewport={{ x: 50, y: 50, zoom: 0.6 }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          
          {/* Controls Panel */}
          <Panel position="top-center" className="mt-2">
            <ControlsPanel
              nodeType={nodeType}
              zoomLevel={zoomLevel}
              onNodeTypeChange={setNodeType}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onFitView={() => fitView({ padding: 0.2, duration: 300 })}
              onZoomChange={handleZoomChange}
            />
          </Panel>
        </ReactFlow>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        selectedNode={selectedNode}
        isEditing={isEditing}
        detailViewMode={detailViewMode}
        goals={goals}
        tags={tags}
        onClose={closeDetailPanel}
        onEdit={() => setIsEditing(true)}
        onDelete={handleDelete}
        onHabitSave={handleHabitSave}
        onGoalSave={handleGoalSave}
        onViewModeChange={setDetailViewMode}
      />
    </div>
  );
}

/**
 * Main export with ReactFlowProvider.
 */
export function EditableMindmapRefactored(props: EditableMindmapProps) {
  return (
    <ReactFlowProvider>
      <EditableMindmapFlow {...props} />
    </ReactFlowProvider>
  );
}

export default EditableMindmapRefactored;
