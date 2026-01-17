"use client"

import React, { useState, useCallback, useMemo, useRef } from "react"
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  NodeProps,
  MarkerType,
  useReactFlow,
  Connection,
  addEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import { HabitModal } from './Modal.Habit'
import { GoalModal } from './Modal.Goal'
import { GoalNodeHandles, HabitNodeHandles } from './Mindmap.Handle'
import type { Habit, Goal } from '../types'
import type { HabitRelation } from '../types/shared'

// Simple lock/unlock SVG icons (keeps UI minimal)
function LockedIcon({ className = 'inline-block', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function UnlockedIcon({ className = 'inline-block', size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M16 11V8a4 4 0 0 0-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" transform="translate(0,0)" />
      <path d="M8 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface UnifiedRelationMapProps {
  habits: Habit[];
  goals: Goal[];
  onClose: () => void;
  embedded?: boolean;
  onRegisterAsHabit?: (data: any) => void;
  onRegisterAsGoal?: (data: any) => void;
}

interface HabitNodeData {
  habit: Habit;
  goal?: Goal;
  relations: HabitRelation[];
  progressPercentage: number;
  isMainHabit?: boolean;
  subHabits?: Habit[];
  isEditing?: boolean;
  label: string;
}

interface GoalNodeData {
  goal: Goal;
  habitCount: number;
  completedHabitCount: number;
  isEditing?: boolean;
  label: string;
}

interface MainHabitGroupNodeData {
  mainHabit: Habit;
  subHabits: Habit[];
  goal?: Goal;
  progressPercentage: number;
  isEditing?: boolean;
  label: string;
}

interface ContextMenu {
  id: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
  nodeType: 'habit' | 'goal' | 'mainGroup';
}

interface ModalState {
  habitModal: boolean;
  goalModal: boolean;
  selectedNodeName: string;
  selectedNodeId: string;
  selectedGoalId?: string;
  connectedNodeIds?: string[]; // つながっているノードのID
  connectedGoalIds?: string[]; // つながっているGoalのID
  connectedHabitIds?: string[]; // つながっているHabitのID
}

// デバイス判定
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768);
};

const getProgressColor = (percentage: number) => {
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 75) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-gray-400';
};

// 編集可能なGoalノード
function EditableGoalNode({ id, data }: NodeProps<GoalNodeData>) {
  const { goal, habitCount, completedHabitCount, isEditing, label } = data;
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const completionPercentage = habitCount > 0 ? (completedHabitCount / habitCount) * 100 : 0;
  const isMobile = isMobileDevice();

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || goal.name;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
  }, [text, id, goal.name, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(label);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
    }
  }, [handleSubmit, label, id, setNodes]);

  return (
    <div className="relative">
      <GoalNodeHandles isMobile={isMobile} />
      
      <div className="min-w-[220px] max-w-[280px] bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-lg shadow-xl border-2 border-purple-400 dark:border-purple-600 overflow-hidden">
        <div className="relative h-2 bg-purple-200 dark:bg-purple-900">
          <div 
            className={`absolute left-0 top-0 h-full ${getProgressColor(completionPercentage)} opacity-70 transition-all duration-300`}
            style={{ width: `${Math.min(completionPercentage, 100)}%` }}
          />
        </div>
        
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🎯</span>
            {isEditing ? (
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSubmit}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-sm font-bold bg-white dark:bg-slate-700 text-purple-900 dark:text-purple-100 border border-purple-400 rounded px-1"
              />
            ) : (
              <div className="text-sm font-bold text-purple-900 dark:text-purple-100 truncate">
                {label}
              </div>
            )}
          </div>
          
          {goal.details && (
            <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 line-clamp-2">
              {goal.details}
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-purple-300 dark:border-purple-700">
            <span className="text-purple-600 dark:text-purple-300">
              {completedHabitCount} / {habitCount}
            </span>
            <span className="font-semibold text-purple-700 dark:text-purple-200">
              {completionPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 編集可能なHabitノード
function EditableHabitNode({ id, data }: NodeProps<HabitNodeData>) {
  const { habit, progressPercentage, isEditing, label } = data;
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const isMobile = isMobileDevice();

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || habit.name;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
  }, [text, id, habit.name, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(label);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
    }
  }, [handleSubmit, label, id, setNodes]);

  return (
    <div className="relative">
      <HabitNodeHandles isMobile={isMobile} />
      
      <div className="min-w-[180px] max-w-[220px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 border-slate-300 dark:border-slate-600 overflow-hidden">
        <div className="relative h-2 bg-slate-200 dark:bg-slate-700">
          <div 
            className={`absolute left-0 top-0 h-full ${getProgressColor(progressPercentage)} opacity-60 transition-all duration-300`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        
        <div className="p-2.5">
          {isEditing ? (
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSubmit}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs font-semibold bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-blue-400 rounded px-1"
            />
          ) : (
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">
              {label}
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-300">
              {habit.count || 0}/{(habit as any).workloadTotal || habit.must || '∞'}
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {progressPercentage.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 編集可能なMain-Subグループノード
function EditableMainHabitGroupNode({ id, data }: NodeProps<MainHabitGroupNodeData>) {
  const { mainHabit, subHabits, progressPercentage, isEditing, label } = data;
  const [text, setText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodes } = useReactFlow();
  const isMobile = isMobileDevice();

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = useCallback(() => {
    const newText = text.trim() || mainHabit.name;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? { ...node, data: { ...node.data, label: newText, isEditing: false } }
          : node
      )
    );
  }, [text, id, mainHabit.name, setNodes]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setText(label);
      setNodes((nds) =>
        nds.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, isEditing: false } }
            : node
        )
      );
    }
  }, [handleSubmit, label, id, setNodes]);

  const calculateProgress = (habit: Habit): number => {
    const total = (habit as any).workloadTotal || habit.must;
    if (!total || total <= 0) return 0;
    const current = habit.count || 0;
    return (current / total) * 100;
  };

  return (
    <div className="relative">
      <HabitNodeHandles isMobile={isMobile} />
      
      <div className="min-w-[260px] max-w-[300px] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg shadow-xl border-3 border-blue-500 dark:border-blue-600 overflow-hidden p-3">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md border-2 border-blue-400 dark:border-blue-500 overflow-hidden mb-2">
          <div className="relative h-2 bg-slate-200 dark:bg-slate-700">
            <div 
              className={`absolute left-0 top-0 h-full ${getProgressColor(progressPercentage)} opacity-60 transition-all duration-300`}
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          
          <div className="p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Main</span>
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSubmit}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs font-semibold bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-blue-400 rounded px-1"
                />
              ) : (
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
                  {label}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-300">
                {mainHabit.count || 0}/{(mainHabit as any).workloadTotal || mainHabit.must || '∞'}
              </span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {progressPercentage.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {subHabits.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 px-1">
              Sub Habits:
            </div>
            {subHabits.map((subHabit) => {
              const subProgress = calculateProgress(subHabit);
              return (
                <div key={subHabit.id} className="bg-white dark:bg-slate-800 rounded-md shadow-sm border border-purple-300 dark:border-purple-600 overflow-hidden">
                  <div className="relative h-1.5 bg-slate-200 dark:bg-slate-700">
                    <div 
                      className={`absolute left-0 top-0 h-full ${getProgressColor(subProgress)} opacity-50 transition-all duration-300`}
                      style={{ width: `${Math.min(subProgress, 100)}%` }}
                    />
                  </div>
                  
                  <div className="p-2">
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {subHabit.name}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-0.5">
                      <span className="text-slate-500 dark:text-slate-400">
                        {subHabit.count || 0}/{(subHabit as any).workloadTotal || subHabit.must || '∞'}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {subProgress.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  habitNode: EditableHabitNode,
  goalNode: EditableGoalNode,
  mainHabitGroupNode: EditableMainHabitGroupNode,
};

function UnifiedRelationMapFlow({ habits, goals, onClose, embedded = false, onRegisterAsHabit, onRegisterAsGoal }: UnifiedRelationMapProps) {
  const [relations, setRelations] = useState<HabitRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    habitModal: false,
    goalModal: false,
    selectedNodeName: '',
    selectedNodeId: '',
    selectedGoalId: undefined,
    connectedNodeIds: [],
    connectedGoalIds: [],
    connectedHabitIds: [],
  });
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const GROUPS_PER_PAGE = 5;
  const [mobileConnectionMode, setMobileConnectionMode] = useState(false);
  const [nodeType, setNodeType] = useState<'habit' | 'goal'>('habit');
  const [isEditMode, setIsEditMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.6);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();
  const isMobile = isMobileDevice();

  // ビューポートの変更を監視してズームレベルを更新
  React.useEffect(() => {
    const updateZoom = () => {
      const viewport = getViewport();
      setZoomLevel(viewport.zoom);
    };
    
    // 初期値を設定
    updateZoom();
    
    // ビューポート変更時に更新（ReactFlowのイベントを使用）
    const interval = setInterval(updateZoom, 100);
    return () => clearInterval(interval);
  }, [getViewport]);

  React.useEffect(() => {
    async function loadAllRelations() {
      setLoading(true);
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
        console.error('[UnifiedRelationMap] Failed to load relations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllRelations();
  }, [habits]);

  const calculateProgress = useCallback((habit: Habit): number => {
    const total = (habit as any).workloadTotal || habit.must;
    if (!total || total <= 0) return 0;
    const current = habit.count || 0;
    return (current / total) * 100;
  }, []);

  // グループ分割機能：つながっているGoal・Habit群を検出
  const connectedGroups = useMemo(() => {
    if (loading) return [];

    const nodeIds = new Set<string>();
    goals.forEach(g => nodeIds.add(`goal-${g.id}`));
    habits.forEach(h => {
      if (!relations.some(r => 
        (r.habitId === h.id || r.relatedHabitId === h.id) && 
        (r.relation === 'main' || r.relation === 'sub')
      )) {
        nodeIds.add(h.id);
      }
    });

    const adjacency = new Map<string, Set<string>>();
    nodeIds.forEach(id => adjacency.set(id, new Set()));

    // Goal階層の接続
    goals.forEach(goal => {
      if (goal.parentId) {
        const parentKey = `goal-${goal.parentId}`;
        const childKey = `goal-${goal.id}`;
        adjacency.get(parentKey)?.add(childKey);
        adjacency.get(childKey)?.add(parentKey);
      }
    });

    // Goal-Habit接続
    habits.forEach(habit => {
      const habitKey = habit.id;
      const goalKey = `goal-${habit.goalId}`;
      if (adjacency.has(goalKey) && adjacency.has(habitKey)) {
        adjacency.get(goalKey)?.add(habitKey);
        adjacency.get(habitKey)?.add(goalKey);
      }
    });

    // Habit間のNext関係
    relations.forEach(rel => {
      if (rel.relation === 'next') {
        adjacency.get(rel.habitId)?.add(rel.relatedHabitId);
        adjacency.get(rel.relatedHabitId)?.add(rel.habitId);
      }
    });

    // 連結成分を検出（Union-Find）
    const visited = new Set<string>();
    const groups: string[][] = [];

    const dfs = (nodeId: string, group: string[]) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      group.push(nodeId);
      adjacency.get(nodeId)?.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, group);
        }
      });
    };

    nodeIds.forEach(nodeId => {
      if (!visited.has(nodeId)) {
        const group: string[] = [];
        dfs(nodeId, group);
        groups.push(group);
      }
    });

    return groups;
  }, [goals, habits, relations, loading]);

  // ノードとエッジの生成（グループフィルタリング対応）
  const { nodes, edges } = useMemo(() => {
    if (loading) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // フィルタリング用のノードIDセット
    const allowedNodeIds = selectedGroup !== null && connectedGroups[selectedGroup]
      ? new Set(connectedGroups[selectedGroup])
      : null;

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
      const goalKey = `goal-${goal.id}`;
      if (allowedNodeIds && !allowedNodeIds.has(goalKey)) return;

      if (!goal.parentId) {
        rootGoals.push(goal);
      } else {
        if (!goalChildren.has(goal.parentId)) {
          goalChildren.set(goal.parentId, []);
        }
        goalChildren.get(goal.parentId)!.push(goal.id);
      }
    });

    // Goalごとのhabits
    const habitsByGoal = new Map<string, Habit[]>();
    habits.forEach(habit => {
      if (subToMain.has(habit.id)) return;
      if (allowedNodeIds && !allowedNodeIds.has(habit.id)) return;
      
      if (!habitsByGoal.has(habit.goalId)) {
        habitsByGoal.set(habit.goalId, []);
      }
      habitsByGoal.get(habit.goalId)!.push(habit);
    });

    // レイアウト定数
    const GOAL_WIDTH = 250;
    const HABIT_WIDTH = 240;
    const MAIN_GROUP_WIDTH = 320;
    const GOAL_VERTICAL_SPACING = 700;
    const ROOT_GOAL_VERTICAL_SPACING = 1200;
    const HABIT_VERTICAL_OFFSET = 150;
    const HABIT_HORIZONTAL_OFFSET = 500;
    const HABIT_INDEX_OFFSET = 150;
    const HABIT_VERTICAL_GAP = 50;
    const MIN_HORIZONTAL_GAP = 300;
    const ROOT_GOAL_X_START = 50;

    function calculateSubtreeHeight(goalId: string): number {
      const children = goalChildren.get(goalId) || [];
      const habitsInGoal = habitsByGoal.get(goalId) || [];
      
      let habitAreaHeight = 0;
      if (habitsInGoal.length > 0) {
        habitsInGoal.forEach((habit) => {
          const subHabitIds = Array.from(mainToSubs.get(habit.id) || []);
          const subHabits = subHabitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[];
          
          if (subHabits.length > 0) {
            habitAreaHeight += 200 + subHabits.length * 100 + HABIT_VERTICAL_GAP;
          } else {
            habitAreaHeight += 150 + HABIT_VERTICAL_GAP;
          }
        });
      }
      
      let childrenHeight = 0;
      if (children.length > 0) {
        children.forEach(childId => {
          childrenHeight += calculateSubtreeHeight(childId);
        });
      }
      
      const goalHeight = 100;
      const totalHeight = goalHeight + Math.max(habitAreaHeight, childrenHeight) + GOAL_VERTICAL_SPACING;
      
      return totalHeight;
    }

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

    function layoutGoalTree(goalId: string, level: number, xStart: number, yStart: number): number {
      const goal = goals.find(g => g.id === goalId);
      if (!goal) return yStart;

      const habitsInGoal = habitsByGoal.get(goalId) || [];
      const completedHabits = habitsInGoal.filter(h => h.completed).length;
      const children = goalChildren.get(goalId) || [];
      const subtreeWidth = calculateSubtreeWidth(goalId);
      
      const goalX = xStart + subtreeWidth / 2 - GOAL_WIDTH / 2;
      const goalY = yStart;

      generatedNodes.push({
        id: `goal-${goalId}`,
        type: 'goalNode',
        position: { x: goalX, y: goalY },
        data: {
          goal,
          habitCount: habitsInGoal.length,
          completedHabitCount: completedHabits,
          isEditing: false,
          label: goal.name,
        },
      });

      let maxHabitY = goalY;
      
      if (habitsInGoal.length > 0) {
        let habitY = goalY + HABIT_VERTICAL_OFFSET;

        habitsInGoal.forEach((habit, index) => {
          const habitX = goalX + HABIT_HORIZONTAL_OFFSET + (index * HABIT_INDEX_OFFSET);
          
          const subHabitIds = Array.from(mainToSubs.get(habit.id) || []);
          const subHabits = subHabitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[];
          const progressPercentage = calculateProgress(habit);

          if (subHabits.length > 0) {
            generatedNodes.push({
              id: `main-group-${habit.id}`,
              type: 'mainHabitGroupNode',
              position: { x: habitX, y: habitY },
              data: {
                mainHabit: habit,
                subHabits,
                goal,
                progressPercentage,
                isEditing: false,
                label: habit.name,
              },
            });

            generatedEdges.push({
              id: `goal-maingroup-${goalId}-${habit.id}`,
              source: `goal-${goalId}`,
              sourceHandle: 'right',
              target: `main-group-${habit.id}`,
              style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
              type: 'step',
              animated: false,
            });
            
            const groupHeight = 200 + subHabits.length * 100 + HABIT_VERTICAL_GAP;
            habitY += groupHeight;
            maxHabitY = Math.max(maxHabitY, habitY);
          } else {
            const habitRelations = relations.filter(
              r => (r.habitId === habit.id || r.relatedHabitId === habit.id) && r.relation === 'next'
            );

            generatedNodes.push({
              id: habit.id,
              type: 'habitNode',
              position: { x: habitX, y: habitY },
              data: {
                habit,
                goal,
                relations: habitRelations,
                progressPercentage,
                isEditing: false,
                label: habit.name,
              },
            });

            generatedEdges.push({
              id: `goal-habit-${goalId}-${habit.id}`,
              source: `goal-${goalId}`,
              sourceHandle: 'right',
              target: habit.id,
              style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
              type: 'step',
              animated: false,
            });
            
            habitY += 150 + HABIT_VERTICAL_GAP;
            maxHabitY = Math.max(maxHabitY, habitY);
          }
        });
      }

      let childYOffset = Math.max(goalY + GOAL_VERTICAL_SPACING, maxHabitY + 200);
      let childXOffset = xStart;
      
      children.forEach((childId) => {
        const childWidth = calculateSubtreeWidth(childId);
        const childEndY = layoutGoalTree(childId, level + 1, childXOffset, childYOffset);
        
        generatedEdges.push({
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
    rootGoals.forEach((rootGoal) => {
      const endY = layoutGoalTree(rootGoal.id, 0, ROOT_GOAL_X_START, currentY);
      currentY = endY + ROOT_GOAL_VERTICAL_SPACING;
    });

    // Next関係のエッジ
    const addedEdgeKeys = new Set<string>();
    
    relations.forEach((rel) => {
      if (rel.relation !== 'next') return;

      const edgeKey = `${rel.habitId}-${rel.relatedHabitId}-next`;
      if (addedEdgeKeys.has(edgeKey)) return;
      addedEdgeKeys.add(edgeKey);

      let source = mainToSubs.has(rel.habitId) ? `main-group-${rel.habitId}` : rel.habitId;
      let target = mainToSubs.has(rel.relatedHabitId) ? `main-group-${rel.relatedHabitId}` : rel.relatedHabitId;

      if (allowedNodeIds && (!allowedNodeIds.has(source) || !allowedNodeIds.has(target))) return;

      generatedEdges.push({
        id: `habit-next-${source}-${target}`,
        source,
        target,
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

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [habits, goals, relations, loading, calculateProgress, selectedGroup, connectedGroups]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  React.useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [nodes, edges, setFlowNodes, setFlowEdges]);

  // 右クリックメニュー
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isMobile) return;
      
      event.preventDefault();
      event.stopPropagation();

      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      if (!pane) return;

      let nodeType: 'habit' | 'goal' | 'mainGroup' = 'habit';
      if (node.id.startsWith('goal-')) {
        nodeType = 'goal';
      } else if (node.id.startsWith('main-group-')) {
        nodeType = 'mainGroup';
      }

      setContextMenu({
        id: node.id,
        top: event.clientY < pane.height - 200 ? event.clientY : undefined,
        left: event.clientX < pane.width - 200 ? event.clientX : undefined,
        right: event.clientX >= pane.width - 200 ? pane.width - event.clientX : undefined,
        bottom: event.clientY >= pane.height - 200 ? pane.height - event.clientY : undefined,
        nodeType,
      });
    },
    [isMobile]
  );

  // ノードダブルクリックで編集
  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
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

  // 新規群（独立したGoal）を追加
  const addNewGroup = useCallback(() => {
    const viewport = { x: 0, y: 0, zoom: 1 };
    
    // 既存のノードの最大Y座標を取得
    const maxY = flowNodes.reduce((max, node) => Math.max(max, node.position.y), 0);
    
    const position = {
      x: 50,
      y: maxY + 800, // 既存の群の下に配置
    };

    const newGoalId = `new-goal-${Date.now()}`;
    const newGoal: Goal = {
      id: newGoalId,
      name: 'New Goal',
      details: '',
      parentId: null,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newNode: Node = {
      id: `goal-${newGoalId}`,
      position,
      data: { 
        goal: newGoal,
        habitCount: 0,
        completedHabitCount: 0,
        label: 'New Goal', 
        isEditing: false 
      },
      type: 'goalNode',
    };

    setFlowNodes((nds) => nds.concat(newNode));
    
    // 新しく作成されたノードを編集モードにする
    setTimeout(() => {
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === newNode.id
            ? { ...n, data: { ...n.data, isEditing: true } }
            : { ...n, data: { ...n.data, isEditing: false } }
        )
      );
    }, 100);
  }, [setFlowNodes, flowNodes]);

  // 接続開始情報を保持
  const [connectionStartInfo, setConnectionStartInfo] = useState<{nodeId: string, handleId?: string} | null>(null);

  // 接続開始時の処理
  const onConnectStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string; handleId?: string }) => {
      setConnectionStartInfo({ nodeId, handleId });
    },
    []
  );

  // 接続終了時の処理（空白にドロップで新規ノード作成）
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
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

        const newNodeId = `new-node-${Date.now()}`;
        
        // NodeTypeに基づいてノードを作成
        let newNode: Node;
        
        if (nodeType === 'goal') {
          const newGoal: Goal = {
            id: newNodeId,
            name: 'New Goal',
            details: '',
            parentId: null,
            isCompleted: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          newNode = {
            id: `goal-${newNodeId}`,
            position,
            data: { 
              goal: newGoal,
              habitCount: 0,
              completedHabitCount: 0,
              label: 'New Goal', 
              isEditing: false,
              sourceNodeId: connectionStartInfo.nodeId,
            },
            type: 'goalNode',
          };
        } else if (nodeType === 'habit') {
          newNode = {
            id: newNodeId,
            position,
            data: { 
              label: 'New Habit', 
              isEditing: false,
              habit: { id: newNodeId, name: 'New Habit', goalId: '', count: 0, must: 0 },
              progressPercentage: 0,
              relations: [],
              sourceNodeId: connectionStartInfo.nodeId,
            },
            type: 'habitNode',
          };
        } else {
          // note
          newNode = {
            id: newNodeId,
            position,
            data: { 
              label: 'New Note', 
              isEditing: false,
              habit: { id: newNodeId, name: 'New Note', goalId: '', count: 0, must: 0 },
              progressPercentage: 0,
              relations: [],
              sourceNodeId: connectionStartInfo.nodeId,
            },
            type: 'habitNode',
          };
        }

        setFlowNodes((nds) => nds.concat(newNode));

        // 接続を作成
        const newEdge = {
          id: `edge-${connectionStartInfo.nodeId}-${newNode.id}`,
          source: connectionStartInfo.nodeId,
          target: newNode.id,
          sourceHandle: connectionStartInfo.handleId || null,
          targetHandle: null,
          animated: true,
          type: 'step',
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#10b981',
          },
        };

        setFlowEdges((eds) => eds.concat(newEdge));
        
        // 新しく作成されたノードを編集モードにする
        setTimeout(() => {
          setFlowNodes((nds) =>
            nds.map((n) =>
              n.id === newNode.id
                ? { ...n, data: { ...n.data, isEditing: true } }
                : { ...n, data: { ...n.data, isEditing: false } }
            )
          );
        }, 100);
      }
      
      setConnectionStartInfo(null);
    },
    [project, setFlowNodes, setFlowEdges, connectionStartInfo, nodeType]
  );

  // 空白クリックで新規ノード作成
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (!reactFlowWrapper.current) return;
    
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const newNodeId = `new-node-${Date.now()}`;
    
    // NodeTypeに基づいてノードを作成
    let newNode: Node;
    
    if (nodeType === 'goal') {
      const newGoal: Goal = {
        id: newNodeId,
        name: 'New Goal',
        details: '',
        parentId: null,
        isCompleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      newNode = {
        id: `goal-${newNodeId}`,
        position,
        data: { 
          goal: newGoal,
          habitCount: 0,
          completedHabitCount: 0,
          label: 'New Goal', 
          isEditing: false 
        },
        type: 'goalNode',
      };
    } else if (nodeType === 'habit') {
      newNode = {
        id: newNodeId,
        position,
        data: { 
          label: 'New Habit', 
          isEditing: false,
          habit: { id: newNodeId, name: 'New Habit', goalId: '', count: 0, must: 0 },
          progressPercentage: 0,
          relations: []
        },
        type: 'habitNode',
      };
    } else {
      // note
      newNode = {
        id: newNodeId,
        position,
        data: { 
          label: 'New Note', 
          isEditing: false,
          habit: { id: newNodeId, name: 'New Note', goalId: '', count: 0, must: 0 },
          progressPercentage: 0,
          relations: []
        },
        type: 'habitNode',
      };
    }

    setFlowNodes((nds) => nds.concat(newNode));
    
    // 新しく作成されたノードを編集モードにする
    setTimeout(() => {
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === newNode.id
            ? { ...n, data: { ...n.data, isEditing: true } }
            : { ...n, data: { ...n.data, isEditing: false } }
        )
      );
    }, 100);
  }, [project, setFlowNodes, nodeType]);

  // エッジ接続
  const onConnect = useCallback(
    (params: Connection) => {
      setFlowEdges((eds) => addEdge(params, eds));
    },
    [setFlowEdges]
  );

  // コンテキストメニューアクション
  const handleEditText = useCallback(() => {
    if (contextMenu) {
      setFlowNodes((nds) =>
        nds.map((n) =>
          n.id === contextMenu.id
            ? { ...n, data: { ...n.data, isEditing: true } }
            : { ...n, data: { ...n.data, isEditing: false } }
        )
      );
    }
    setContextMenu(null);
  }, [contextMenu, setFlowNodes]);

  const handleRegisterAsHabit = useCallback(() => {
    if (contextMenu) {
      const node = flowNodes.find(n => n.id === contextMenu.id);
      if (node) {
        console.log('[UnifiedRelationMap] handleRegisterAsHabit - node:', node);
        
        // ノードからGoal情報を取得
        let goalId: string | undefined;
        if (node.data.goal) {
          goalId = node.data.goal.id;
        } else if (node.data.habit) {
          goalId = node.data.habit.goalId;
        }
        
        // つながっているノードを取得
        const connectedEdges = flowEdges.filter(
          e => e.source === contextMenu.id || e.target === contextMenu.id
        );
        const connectedNodeIds = connectedEdges.map(e => 
          e.source === contextMenu.id ? e.target : e.source
        );
        
        console.log('[UnifiedRelationMap] connectedEdges:', connectedEdges);
        console.log('[UnifiedRelationMap] connectedNodeIds:', connectedNodeIds);
        
        // つながっているGoalとHabitを分類
        const connectedGoalIds: string[] = [];
        const connectedHabitIds: string[] = [];
        
        // 結線元のノードIDを確認（新規ノード作成時に保存された情報）
        if (node.data.sourceNodeId) {
          console.log('[UnifiedRelationMap] sourceNodeId found:', node.data.sourceNodeId);
          const sourceNode = flowNodes.find(n => n.id === node.data.sourceNodeId);
          if (sourceNode) {
            console.log('[UnifiedRelationMap] sourceNode:', sourceNode);
            // 結線元がHabitの場合、Related Habitとして追加
            if (sourceNode.data.habit) {
              const habitId = sourceNode.data.habit.id;
              console.log('[UnifiedRelationMap] Adding habit from sourceNode:', habitId);
              if (!connectedHabitIds.includes(habitId)) {
                connectedHabitIds.push(habitId);
              }
            }
            // 結線元がMain-Subグループの場合
            else if (sourceNode.data.mainHabit) {
              const habitId = sourceNode.data.mainHabit.id;
              console.log('[UnifiedRelationMap] Adding mainHabit from sourceNode:', habitId);
              if (!connectedHabitIds.includes(habitId)) {
                connectedHabitIds.push(habitId);
              }
            }
          }
        }
        
        connectedNodeIds.forEach(nodeId => {
          const connectedNode = flowNodes.find(n => n.id === nodeId);
          if (connectedNode) {
            if (nodeId.startsWith('goal-')) {
              // Goalノード
              const goalIdFromNode = nodeId.replace('goal-', '');
              connectedGoalIds.push(goalIdFromNode);
              // 親Goalとして設定
              if (!goalId) {
                goalId = goalIdFromNode;
              }
            } else if (connectedNode.data.habit) {
              // Habitノード
              const habitId = connectedNode.data.habit.id;
              console.log('[UnifiedRelationMap] Adding habit from connectedNode:', habitId);
              if (!connectedHabitIds.includes(habitId)) {
                connectedHabitIds.push(habitId);
              }
            } else if (connectedNode.data.mainHabit) {
              // Main-Subグループノード
              const habitId = connectedNode.data.mainHabit.id;
              console.log('[UnifiedRelationMap] Adding mainHabit from connectedNode:', habitId);
              if (!connectedHabitIds.includes(habitId)) {
                connectedHabitIds.push(habitId);
              }
            }
          }
        });
        
        console.log('[UnifiedRelationMap] Final connectedHabitIds:', connectedHabitIds);
        console.log('[UnifiedRelationMap] Final goalId:', goalId);
        
        setModalState({
          habitModal: true,
          goalModal: false,
          selectedNodeName: node.data.label,
          selectedNodeId: contextMenu.id,
          selectedGoalId: goalId,
          connectedNodeIds,
          connectedGoalIds,
          connectedHabitIds,
        });
      }
    }
    setContextMenu(null);
  }, [contextMenu, flowNodes, flowEdges]);

  const handleRegisterAsGoal = useCallback(() => {
    if (contextMenu) {
      const node = flowNodes.find(n => n.id === contextMenu.id);
      if (node) {
        console.log('[UnifiedRelationMap] handleRegisterAsGoal - node:', node);
        
        // ノードからGoal情報を取得（親Goal）
        let parentGoalId: string | undefined;
        if (node.data.goal && node.data.goal.parentId) {
          parentGoalId = node.data.goal.parentId;
        }
        
        // 結線元のノードIDを確認（新規ノード作成時に保存された情報）
        if (node.data.sourceNodeId) {
          console.log('[UnifiedRelationMap] sourceNodeId found:', node.data.sourceNodeId);
          const sourceNode = flowNodes.find(n => n.id === node.data.sourceNodeId);
          if (sourceNode) {
            console.log('[UnifiedRelationMap] sourceNode:', sourceNode);
            // 結線元がGoalの場合、Parent Goalとして設定
            if (sourceNode.data.goal) {
              parentGoalId = sourceNode.data.goal.id;
              console.log('[UnifiedRelationMap] Setting parentGoalId from sourceNode.data.goal:', parentGoalId);
            }
            // 結線元がGoalノードの場合（goal-プレフィックス付き）
            else if (node.data.sourceNodeId.startsWith('goal-')) {
              parentGoalId = node.data.sourceNodeId.replace('goal-', '');
              console.log('[UnifiedRelationMap] Setting parentGoalId from goal- prefix:', parentGoalId);
            }
          }
        }
        
        // つながっているノードを取得
        const connectedEdges = flowEdges.filter(
          e => e.source === contextMenu.id || e.target === contextMenu.id
        );
        const connectedNodeIds = connectedEdges.map(e => 
          e.source === contextMenu.id ? e.target : e.source
        );
        
        console.log('[UnifiedRelationMap] connectedEdges:', connectedEdges);
        console.log('[UnifiedRelationMap] connectedNodeIds:', connectedNodeIds);
        
        // つながっているGoalを取得（親Goalとして設定）
        const connectedGoalIds: string[] = [];
        
        connectedNodeIds.forEach(nodeId => {
          if (nodeId.startsWith('goal-')) {
            const goalIdFromNode = nodeId.replace('goal-', '');
            connectedGoalIds.push(goalIdFromNode);
            // 親Goalとして設定（まだ設定されていない場合）
            if (!parentGoalId) {
              parentGoalId = goalIdFromNode;
              console.log('[UnifiedRelationMap] Setting parentGoalId from connectedNode:', parentGoalId);
            }
          }
        });
        
        console.log('[UnifiedRelationMap] Final parentGoalId:', parentGoalId);
        
        setModalState({
          habitModal: false,
          goalModal: true,
          selectedNodeName: node.data.label,
          selectedNodeId: contextMenu.id,
          selectedGoalId: parentGoalId,
          connectedNodeIds,
          connectedGoalIds,
          connectedHabitIds: [],
        });
      }
    }
    setContextMenu(null);
  }, [contextMenu, flowNodes, flowEdges]);

  const handleDeleteNode = useCallback(() => {
    if (contextMenu) {
      setFlowNodes((nds) => nds.filter((node) => node.id !== contextMenu.id));
      setFlowEdges((eds) => eds.filter((edge) => 
        edge.source !== contextMenu.id && edge.target !== contextMenu.id
      ));
    }
    setContextMenu(null);
  }, [contextMenu, setFlowNodes, setFlowEdges]);

  const handleModalClose = useCallback(() => {
    setModalState({
      habitModal: false,
      goalModal: false,
      selectedNodeName: '',
      selectedNodeId: '',
      selectedGoalId: undefined,
      connectedNodeIds: [],
      connectedGoalIds: [],
      connectedHabitIds: [],
    });
  }, []);

  const handleHabitCreate = useCallback(async (payload: any) => {
    if (onRegisterAsHabit) {
      await onRegisterAsHabit(payload);
    }
    // ノードの色を変更（Habitとして登録済み）
    setFlowNodes((nds) =>
      nds.map((n) =>
        n.id === modalState.selectedNodeId
          ? { ...n, data: { ...n.data, nodeType: 'habit' } }
          : n
      )
    );
    handleModalClose();
  }, [onRegisterAsHabit, handleModalClose, modalState.selectedNodeId, setFlowNodes]);

  const handleGoalCreate = useCallback(async (payload: any) => {
    console.log('[UnifiedRelationMap] handleGoalCreate called with payload:', payload);
    console.log('[UnifiedRelationMap] modalState.selectedNodeId:', modalState.selectedNodeId);
    
    let createdGoal: Goal | null = null;
    if (onRegisterAsGoal) {
      createdGoal = (await onRegisterAsGoal(payload)) as unknown as Goal | null;
      console.log('[UnifiedRelationMap] onRegisterAsGoal completed, created goal:', createdGoal);
    }
    
    if (createdGoal) {
      // 作成されたGoalでノードを更新
      setFlowNodes((nds) => {
        const updated = nds.map((n) =>
          n.id === modalState.selectedNodeId
            ? { 
                ...n, 
                type: 'goalNode',
                id: `goal-${createdGoal!.id}`,
                data: { 
                  goal: createdGoal!,
                  habitCount: 0,
                  completedHabitCount: 0,
                  label: createdGoal!.name,
                  isEditing: false,
                } 
              }
            : n
        );
        console.log('[UnifiedRelationMap] Updated nodes:', updated);
        return updated;
      });
      
      // エッジのIDも更新し、Goal階層の結線スタイルに変更
      setFlowEdges((eds) => {
        const updated = eds.map((e) => {
          const isSourceUpdated = e.source === modalState.selectedNodeId;
          const isTargetUpdated = e.target === modalState.selectedNodeId;
          
          return {
            ...e,
            source: isSourceUpdated ? `goal-${createdGoal!.id}` : e.source,
            target: isTargetUpdated ? `goal-${createdGoal!.id}` : e.target,
            // Goal階層の結線スタイルに変更
            style: { stroke: '#9333ea', strokeWidth: 3 },
            type: 'step',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#9333ea',
            },
            animated: false,
          };
        });
        console.log('[UnifiedRelationMap] Updated edges:', updated);
        return updated;
      });
    } else {
      console.log('[UnifiedRelationMap] Created goal is null!');
    }
    
    handleModalClose();
  }, [onRegisterAsGoal, handleModalClose, modalState.selectedNodeId, setFlowNodes, setFlowEdges]);

  if (loading) {
    const content = (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-700 dark:text-slate-300">読み込み中...</p>
        </div>
      </div>
    );

    if (embedded) {
      return content;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 shadow-xl">
          {content}
        </div>
      </div>
    );
  }

  if (flowNodes.length === 0) {
    const content = (
      <div className="text-center p-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
          統合関係性マップ
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Goalまたは関係性が設定されているHabitがありません。
        </p>
        {!embedded && (
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            閉じる
          </button>
        )}
      </div>
    );

    if (embedded) {
      return content;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-8 shadow-xl max-w-md">
          {content}
        </div>
      </div>
    );
  }

  // 埋め込みモード
  if (embedded) {
    return (
      <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 群フィルター - モバイル対応 */}
              {connectedGroups.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">群:</span>
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${selectedGroup === null ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                  >
                    全体
                  </button>
                  {connectedGroups.length > GROUPS_PER_PAGE && (
                    <button
                      onClick={() => setGroupPage(Math.max(0, groupPage - 1))}
                      disabled={groupPage === 0}
                      className={`px-2 py-1 text-xs rounded transition-colors ${groupPage === 0 ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                    >
                      ‹
                    </button>
                  )}
                  {connectedGroups
                    .slice(groupPage * GROUPS_PER_PAGE, (groupPage + 1) * GROUPS_PER_PAGE)
                    .map((_, idx) => {
                      const actualIdx = groupPage * GROUPS_PER_PAGE + idx;
                      return (
                        <button
                          key={actualIdx}
                          onClick={() => setSelectedGroup(actualIdx)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${selectedGroup === actualIdx ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        >
                          {actualIdx + 1}
                        </button>
                      );
                    })}
                  {connectedGroups.length > GROUPS_PER_PAGE && (
                    <button
                      onClick={() => setGroupPage(Math.min(Math.ceil(connectedGroups.length / GROUPS_PER_PAGE) - 1, groupPage + 1))}
                      disabled={groupPage >= Math.ceil(connectedGroups.length / GROUPS_PER_PAGE) - 1}
                      className={`px-2 py-1 text-xs rounded transition-colors ${groupPage >= Math.ceil(connectedGroups.length / GROUPS_PER_PAGE) - 1 ? 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                    >
                      ›
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => setMobileConnectionMode(!mobileConnectionMode)}
                  className={`px-2 py-1 text-xs rounded ${mobileConnectionMode ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                  title="接続モード"
                >
                  🔗
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper} onClick={() => setContextMenu(null)}>
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 50, y: 50, zoom: 0.6 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'step',
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            
            {/* ズームコントロールパネル - 半透明 */}
            <Panel position="top-center" className="mt-2">
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-lg px-3 py-2 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-2">
                  {/* ズームコントロール */}
                  <button
                    onClick={() => zoomOut()}
                    className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    title="ズームアウト"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={zoomLevel}
                    onChange={(e) => {
                      const zoom = parseFloat(e.target.value);
                      setZoomLevel(zoom);
                      const viewport = getViewport();
                      setViewport({ ...viewport, zoom });
                    }}
                    className="w-24 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0"
                    title="ズーム"
                  />
                  <button
                    onClick={() => zoomIn()}
                    className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    title="ズームイン"
                  >
                    ＋
                  </button>
                  <button
                    onClick={() => fitView({ padding: 0.2, duration: 300 })}
                    className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    title="全体表示"
                  >
                    ⊡
                  </button>
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* コンテキストメニュー */}
        {!isMobile && contextMenu && (
          <div
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 z-50"
            style={{
              top: contextMenu.top,
              left: contextMenu.left,
              right: contextMenu.right,
              bottom: contextMenu.bottom,
            }}
          >
            <button
              onClick={handleEditText}
              className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
            >
              <span>✏️</span>
              テキスト編集
            </button>
            <hr className="my-1 border-gray-600" />
            <button
              onClick={handleDeleteNode}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
            >
              <span>🗑️</span>
              削除
            </button>
          </div>
        )}

        {/* モーダル */}
        <HabitModal
          open={modalState.habitModal}
          onClose={handleModalClose}
          habit={null}
          initial={{ 
            name: modalState.selectedNodeName,
            date: new Date().toISOString().slice(0, 10),
            goalId: modalState.selectedGoalId || (goals.length > 0 ? goals[0].id : undefined),
            relatedHabitIds: modalState.connectedHabitIds || []
          }}
          onCreate={(payload) => {
            handleHabitCreate(payload);
          }}
          categories={goals}
        />

        <GoalModal
          open={modalState.goalModal}
          onClose={handleModalClose}
          goal={null}
          initial={{
            name: modalState.selectedNodeName,
            parentId: modalState.selectedGoalId || null,
          }}
          onCreate={(payload) => {
            console.log('[UnifiedRelationMap] GoalModal onCreate called with:', payload);
            handleGoalCreate(payload);
          }}
          goals={goals}
        />
      </div>
    );
  }

  // フルスクリーンモードは削除（冗長なため）
  return null;
}

export function UnifiedRelationMap(props: UnifiedRelationMapProps) {
  return (
    <ReactFlowProvider>
      <UnifiedRelationMapFlow {...props} />
    </ReactFlowProvider>
  );
}

