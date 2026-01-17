/**
 * useEditableMindmapState Hook
 * 
 * Manages state for the EditableMindmap component.
 * Handles nodes, edges, selection, and UI state.
 */

import { useState, useCallback, useEffect } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import type { Habit, Goal } from '../types';

/** Node data for Goal nodes */
export interface GoalNodeData {
  goal: Goal;
  habitCount: number;
  completedHabitCount: number;
  isEditing?: boolean;
  label: string;
}

/** Node data for Habit nodes */
export interface HabitNodeData {
  habit: Habit;
  goal?: Goal;
  progressPercentage: number;
  isEditing?: boolean;
  label: string;
}

/** Props for the hook */
interface UseEditableMindmapStateProps {
  habits: Habit[];
  goals: Goal[];
}

/** Return type for the hook */
interface UseEditableMindmapStateReturn {
  // Node state
  flowNodes: Node[];
  setFlowNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodesChange: any;
  
  // Edge state
  flowEdges: Edge[];
  setFlowEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange: any;
  
  // Selection state
  selectedNode: Node | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<Node | null>>;
  
  // UI state
  nodeType: 'habit' | 'goal';
  setNodeType: React.Dispatch<React.SetStateAction<'habit' | 'goal'>>;
  isEditing: boolean;
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
  detailViewMode: 'normal' | 'detail';
  setDetailViewMode: React.Dispatch<React.SetStateAction<'normal' | 'detail'>>;
  zoomLevel: number;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
  
  // Connection state
  connectionStartInfo: { nodeId: string; handleId?: string } | null;
  setConnectionStartInfo: React.Dispatch<React.SetStateAction<{ nodeId: string; handleId?: string } | null>>;
}

/**
 * Custom hook for managing EditableMindmap state.
 * 
 * @param props - Hook configuration
 * @returns State and setters for the EditableMindmap component
 */
export function useEditableMindmapState({
  habits,
  goals,
}: UseEditableMindmapStateProps): UseEditableMindmapStateReturn {
  // Node and edge state
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  
  // Selection state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  // UI state
  const [nodeType, setNodeType] = useState<'habit' | 'goal'>('habit');
  const [isEditing, setIsEditing] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState<'normal' | 'detail'>('normal');
  const [zoomLevel, setZoomLevel] = useState(0.8);
  
  // Connection state
  const [connectionStartInfo, setConnectionStartInfo] = useState<{ nodeId: string; handleId?: string } | null>(null);

  // Initialize nodes and edges from habits and goals
  useEffect(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    goals.forEach((goal, index) => {
      const habitsInGoal = habits.filter(h => h.goalId === goal.id);
      const completedHabits = habitsInGoal.filter(h => h.completed).length;

      // Create goal node
      initialNodes.push({
        id: `goal-${goal.id}`,
        type: 'goalNode',
        position: { x: 100, y: 100 + index * 300 },
        data: {
          goal,
          habitCount: habitsInGoal.length,
          completedHabitCount: completedHabits,
          isEditing: false,
          label: goal.name,
        } as GoalNodeData,
      });

      // Create habit nodes for this goal
      habitsInGoal.forEach((habit, hIndex) => {
        const progressPercentage = ((habit as any).workloadTotal || habit.must) > 0
          ? ((habit.count || 0) / ((habit as any).workloadTotal || habit.must)) * 100
          : 0;

        initialNodes.push({
          id: `habit-${habit.id}`,
          type: 'habitNode',
          position: { x: 400, y: 100 + index * 300 + hIndex * 100 },
          data: {
            habit,
            goal,
            progressPercentage,
            isEditing: false,
            label: habit.name,
          } as HabitNodeData,
        });

        // Create edge from goal to habit
        initialEdges.push({
          id: `edge-goal-${goal.id}-habit-${habit.id}`,
          source: `goal-${goal.id}`,
          target: `habit-${habit.id}`,
          style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
          type: 'step',
        });
      });

      // Create edge from parent goal if exists
      if (goal.parentId) {
        initialEdges.push({
          id: `edge-goal-${goal.parentId}-goal-${goal.id}`,
          source: `goal-${goal.parentId}`,
          target: `goal-${goal.id}`,
          style: { stroke: '#9333ea', strokeWidth: 3 },
          type: 'step',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9333ea',
          },
        });
      }
    });

    setFlowNodes(initialNodes);
    setFlowEdges(initialEdges);
  }, [goals, habits, setFlowNodes, setFlowEdges]);

  return {
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
  };
}
