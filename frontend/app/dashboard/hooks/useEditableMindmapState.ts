/**
 * useEditableMindmapState Hook
 * 
 * Manages state for the EditableMindmap component.
 * Handles nodes, edges, selection, and UI state.
 */

import { useState, useCallback, useEffect } from 'react';
import { Node, Edge, useNodesState, useEdgesState, MarkerType, OnNodesChange, OnEdgesChange } from 'reactflow';
import type { Habit, Goal } from '../types';
import type { HabitRelation } from '../types/shared';
import { supabaseDirectClient } from '../../../lib/supabase-direct';

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
  onNodesChange: OnNodesChange;
  
  // Edge state
  flowEdges: Edge[];
  setFlowEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onEdgesChange: OnEdgesChange;
  
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
  const [zoomLevel, setZoomLevel] = useState(0.6); // Match UnifiedRelationMap's initial zoom
  
  // Connection state
  const [connectionStartInfo, setConnectionStartInfo] = useState<{ nodeId: string; handleId?: string } | null>(null);
  
  // Relations state
  const [relations, setRelations] = useState<HabitRelation[]>([]);

  // Load habit relations
  useEffect(() => {
    async function loadAllRelations() {
      try {
        const allRelations: HabitRelation[] = [];
        for (const habit of habits) {
          const rels = await supabaseDirectClient.getHabitRelations(habit.id);
          if (Array.isArray(rels)) {
            allRelations.push(...rels);
          }
        }
        setRelations(allRelations);
      } catch (err) {
        console.error('[useEditableMindmapState] Failed to load relations:', err);
      }
    }
    loadAllRelations();
  }, [habits]);

  // Initialize nodes and edges from habits and goals (matching UnifiedRelationMap layout)
  useEffect(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    // Main-Sub関係を解析
    const mainToSubs = new Map<string, Set<string>>();
    const subToMain = new Map<string, string>();
    
    relations.forEach(rel => {
      if (rel.relation === 'main') {
        if (!mainToSubs.has(rel.relatedHabitId)) {
          mainToSubs.set(rel.relatedHabitId, new Set());
        }
        mainToSubs.get(rel.relatedHabitId)!.add(rel.habitId);
        subToMain.set(rel.habitId, rel.relatedHabitId);
      } else if (rel.relation === 'sub') {
        if (!mainToSubs.has(rel.habitId)) {
          mainToSubs.set(rel.habitId, new Set());
        }
        mainToSubs.get(rel.habitId)!.add(rel.relatedHabitId);
        subToMain.set(rel.relatedHabitId, rel.habitId);
      }
    });

    // Goal階層構造
    const goalChildren = new Map<string, string[]>();
    const rootGoals: Goal[] = [];
    
    goals.forEach(goal => {
      if (!goal.parentId) {
        rootGoals.push(goal);
      } else {
        if (!goalChildren.has(goal.parentId)) {
          goalChildren.set(goal.parentId, []);
        }
        goalChildren.get(goal.parentId)!.push(goal.id);
      }
    });

    // Goalごとのhabits（subHabitは除外）
    const habitsByGoal = new Map<string, Habit[]>();
    habits.forEach(habit => {
      if (subToMain.has(habit.id)) return; // subHabitは除外
      
      if (!habitsByGoal.has(habit.goalId)) {
        habitsByGoal.set(habit.goalId, []);
      }
      habitsByGoal.get(habit.goalId)!.push(habit);
    });

    // レイアウト定数 - UnifiedRelationMapと同じ
    const GOAL_WIDTH = 200;
    const MAIN_GROUP_WIDTH = 240;
    const GOAL_VERTICAL_SPACING = 200;
    const HABIT_VERTICAL_OFFSET = 80;
    const HABIT_HORIZONTAL_OFFSET = 250;
    const HABIT_INDEX_OFFSET = 80;
    const HABIT_VERTICAL_GAP = 20;
    const MIN_HORIZONTAL_GAP = 100;
    const ROOT_GOAL_X_START = 30;

    const calculateProgress = (habit: Habit): number => {
      const total = (habit as any).workloadTotal || habit.must;
      if (!total || total <= 0) return 0;
      const current = habit.count || 0;
      return (current / total) * 100;
    };

    function calculateSubtreeWidth(goalId: string): number {
      const children = goalChildren.get(goalId) || [];
      const habitsInGoal = habitsByGoal.get(goalId) || [];
      
      let habitAreaWidth = 0;
      if (habitsInGoal.length > 0) {
        habitAreaWidth = HABIT_HORIZONTAL_OFFSET + (habitsInGoal.length - 1) * HABIT_INDEX_OFFSET + MAIN_GROUP_WIDTH;
      }
      
      let childrenWidth = 0;
      if (children.length > 0) {
        childrenWidth = children.reduce((sum, childId) => {
          return sum + calculateSubtreeWidth(childId);
        }, 0) + (children.length - 1) * MIN_HORIZONTAL_GAP;
      }
      
      return Math.max(GOAL_WIDTH, habitAreaWidth, childrenWidth);
    }

    function calculateActualSubtreeHeight(goalId: string): number {
      const children = goalChildren.get(goalId) || [];
      const habitsInGoal = habitsByGoal.get(goalId) || [];
      
      let habitAreaHeight = 0;
      if (habitsInGoal.length > 0) {
        habitsInGoal.forEach((habit) => {
          const subHabitIds = Array.from(mainToSubs.get(habit.id) || []);
          const subHabits = subHabitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[];
          
          if (subHabits.length > 0) {
            habitAreaHeight += 80 + subHabits.length * 40 + HABIT_VERTICAL_GAP;
          } else {
            habitAreaHeight += 50 + HABIT_VERTICAL_GAP;
          }
        });
      }
      
      let childrenHeight = 0;
      if (children.length > 0) {
        childrenHeight = Math.max(...children.map(childId => calculateActualSubtreeHeight(childId)));
        childrenHeight += GOAL_VERTICAL_SPACING;
      }
      
      return 60 + Math.max(habitAreaHeight, childrenHeight);
    }

    function layoutGoalTree(goalId: string, level: number, xStart: number, yStart: number): number {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return yStart;

      const habitsInGoal = habitsByGoal.get(goalId) || [];
      const completedHabits = habitsInGoal.filter(h => h.completed).length;
      const children = goalChildren.get(goalId) || [];
      const subtreeWidth = calculateSubtreeWidth(goalId);
      
      const goalX = xStart + subtreeWidth / 2 - GOAL_WIDTH / 2;
      const goalY = yStart;

      initialNodes.push({
        id: `goal-${goalId}`,
        type: 'goalNode',
        position: { x: goalX, y: goalY },
        data: {
          goal,
          habitCount: habitsInGoal.length,
          completedHabitCount: completedHabits,
          isEditing: false,
          label: goal.name,
        } as GoalNodeData,
      });

      let maxHabitY = goalY;
      
      if (habitsInGoal.length > 0) {
        let habitY = goalY + HABIT_VERTICAL_OFFSET;

        habitsInGoal.forEach((habit, index) => {
          const habitX = goalX + HABIT_HORIZONTAL_OFFSET + (index * HABIT_INDEX_OFFSET);
          const progressPercentage = calculateProgress(habit);

          initialNodes.push({
            id: `habit-${habit.id}`,
            type: 'habitNode',
            position: { x: habitX, y: habitY },
            data: {
              habit,
              goal,
              progressPercentage,
              isEditing: false,
              label: habit.name,
            } as HabitNodeData,
          });

          initialEdges.push({
            id: `goal-habit-${goalId}-${habit.id}`,
            source: `goal-${goalId}`,
            sourceHandle: 'right',
            target: `habit-${habit.id}`,
            style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
            type: 'step',
            animated: false,
          });
          
          habitY += 50 + HABIT_VERTICAL_GAP;
          maxHabitY = Math.max(maxHabitY, habitY);
        });
      }

      let childYOffset = Math.max(goalY + GOAL_VERTICAL_SPACING, maxHabitY + 50);
      let childXOffset = xStart;
      
      children.forEach((childId) => {
        const childWidth = calculateSubtreeWidth(childId);
        layoutGoalTree(childId, level + 1, childXOffset, childYOffset);
        
        initialEdges.push({
          id: `goal-goal-${goalId}-${childId}`,
          source: `goal-${goalId}`,
          target: `goal-${childId}`,
          style: { stroke: '#9333ea', strokeWidth: 3 },
          type: 'step',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#9333ea',
          },
        });
        
        childXOffset += childWidth + MIN_HORIZONTAL_GAP;
      });

      return Math.max(maxHabitY, childYOffset);
    }

    let currentY = 0;
    let currentX = ROOT_GOAL_X_START;
    const MAX_WIDTH = 1200;
    let rowMaxHeight = 0;
    
    rootGoals.forEach((rootGoal) => {
      const subtreeWidth = calculateSubtreeWidth(rootGoal.id);
      const actualHeight = calculateActualSubtreeHeight(rootGoal.id);
      
      if (currentX > ROOT_GOAL_X_START && currentX + subtreeWidth > MAX_WIDTH) {
        currentX = ROOT_GOAL_X_START;
        currentY += rowMaxHeight + 30;
        rowMaxHeight = 0;
      }
      
      layoutGoalTree(rootGoal.id, 0, currentX, currentY);
      
      currentX += subtreeWidth + MIN_HORIZONTAL_GAP;
      rowMaxHeight = Math.max(rowMaxHeight, actualHeight);
    });

    // Next関係のエッジ
    const addedEdgeKeys = new Set<string>();
    
    relations.forEach((rel) => {
      if (rel.relation !== 'next') return;

      const edgeKey = `${rel.habitId}-${rel.relatedHabitId}-next`;
      if (addedEdgeKeys.has(edgeKey)) return;
      addedEdgeKeys.add(edgeKey);

      initialEdges.push({
        id: `habit-next-${rel.habitId}-${rel.relatedHabitId}`,
        source: `habit-${rel.habitId}`,
        target: `habit-${rel.relatedHabitId}`,
        label: '→',
        animated: true,
        type: 'step',
        style: { stroke: '#10b981', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#10b981',
        },
        labelStyle: { 
          fill: '#10b981', 
          fontWeight: 600,
          fontSize: 11,
        },
        labelBgStyle: { 
          fill: 'white', 
          fillOpacity: 0.9,
        },
        zIndex: 10,
      });
    });

    setFlowNodes(initialNodes);
    setFlowEdges(initialEdges);
  }, [goals, habits, relations, setFlowNodes, setFlowEdges]);

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
