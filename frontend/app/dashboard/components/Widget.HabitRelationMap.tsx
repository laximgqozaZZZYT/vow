"use client"

import React, { useState, useCallback, useMemo } from "react"
import ReactFlow, {
  Node,
  Edge,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position,
  NodeProps,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import type { Habit, Goal } from '../types'
import type { HabitRelation } from '../types/shared'

interface HabitRelationMapProps {
  habits: Habit[];
  goals: Goal[];
  onClose: () => void;
  embedded?: boolean; // 埋め込みモード用フラグ
}

interface HabitNodeData {
  habit: Habit;
  goal?: Goal;
  relations: HabitRelation[];
  progressPercentage: number;
  isMainHabit?: boolean;
  subHabits?: Habit[];
}

interface GoalNodeData {
  goal: Goal;
  habitCount: number;
  completedHabitCount: number;
}

interface MainHabitGroupNodeData {
  mainHabit: Habit;
  subHabits: Habit[];
  goal?: Goal;
  progressPercentage: number;
}

// カスタムGoalノードコンポーネント
function GoalNode({ id, data }: NodeProps<GoalNodeData>) {
  const { goal, habitCount, completedHabitCount } = data;
  const completionPercentage = habitCount > 0 ? (completedHabitCount / habitCount) * 100 : 0;
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-500" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-500" />
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-purple-500" />
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-purple-500" />
      
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
            <div className="text-sm font-bold text-purple-900 dark:text-purple-100 truncate">
              {goal.name}
            </div>
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

// Main-Subグループノードコンポーネント（入れ子構造）
function MainHabitGroupNode({ id, data }: NodeProps<MainHabitGroupNodeData>) {
  const { mainHabit, subHabits, progressPercentage } = data;
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const calculateProgress = (habit: Habit): number => {
    const total = (habit as any).workloadTotal || habit.must;
    if (!total || total <= 0) return 0;
    const current = habit.count || 0;
    return (current / total) * 100;
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
      
      {/* Main Habitの箱 */}
      <div className="min-w-[260px] max-w-[300px] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg shadow-xl border-3 border-blue-500 dark:border-blue-600 overflow-hidden p-3">
        {/* Main Habit */}
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
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
                {mainHabit.name}
              </div>
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

        {/* Sub Habits */}
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

// カスタムHabitノードコンポーネント
function HabitNode({ id, data }: NodeProps<HabitNodeData>) {
  const { habit, progressPercentage } = data;
  
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-500" />
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
      
      <div className="min-w-[180px] max-w-[220px] bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 border-slate-300 dark:border-slate-600 overflow-hidden">
        <div className="relative h-2 bg-slate-200 dark:bg-slate-700">
          <div 
            className={`absolute left-0 top-0 h-full ${getProgressColor(progressPercentage)} opacity-60 transition-all duration-300`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          />
        </div>
        
        <div className="p-2.5">
          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-1 truncate">
            {habit.name}
          </div>
          
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

const nodeTypes = {
  habitNode: HabitNode,
  goalNode: GoalNode,
  mainHabitGroupNode: MainHabitGroupNode,
};

function HabitRelationMapFlow({ habits, goals, onClose, embedded = false }: HabitRelationMapProps) {
  const [relations, setRelations] = useState<HabitRelation[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.error('[HabitRelationMap] Failed to load relations:', err);
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

  const { nodes, edges } = useMemo(() => {
    if (loading) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];

    // Main-Sub関係を解析（重複を防ぐ）
    const mainToSubs = new Map<string, Set<string>>(); // mainHabitId -> Set<subHabitIds>
    const subToMain = new Map<string, string>(); // subHabitId -> mainHabitId
    
    relations.forEach(rel => {
      if (rel.relation === 'main') {
        // habitId=Sub, relatedHabitId=Main
        if (!mainToSubs.has(rel.relatedHabitId)) {
          mainToSubs.set(rel.relatedHabitId, new Set());
        }
        mainToSubs.get(rel.relatedHabitId)!.add(rel.habitId);
        subToMain.set(rel.habitId, rel.relatedHabitId);
      } else if (rel.relation === 'sub') {
        // habitId=Main, relatedHabitId=Sub
        if (!mainToSubs.has(rel.habitId)) {
          mainToSubs.set(rel.habitId, new Set());
        }
        mainToSubs.get(rel.habitId)!.add(rel.relatedHabitId);
        subToMain.set(rel.relatedHabitId, rel.habitId);
      }
    });

    // Goal階層構造を構築
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

    // Goalごとのhabits（Subを除外）
    const habitsByGoal = new Map<string, Habit[]>();
    habits.forEach(habit => {
      // Subとして他のHabitに含まれる場合はスキップ
      if (subToMain.has(habit.id)) {
        return;
      }
      
      if (!habitsByGoal.has(habit.goalId)) {
        habitsByGoal.set(habit.goalId, []);
      }
      habitsByGoal.get(habit.goalId)!.push(habit);
    });

    // レイアウト定数
    const GOAL_WIDTH = 250;
    const HABIT_WIDTH = 240;
    const MAIN_GROUP_WIDTH = 320;
    const GOAL_VERTICAL_SPACING = 700; // 親子Goal間の垂直距離
    const ROOT_GOAL_VERTICAL_SPACING = 1200; // ルートGoal間の垂直距離（群の間隔を大きく）
    const HABIT_VERTICAL_OFFSET = 150; // Goalから最初のHabitまでの距離
    const HABIT_HORIZONTAL_OFFSET = 500; // Habitを右に大きく配置
    const HABIT_INDEX_OFFSET = 150; // 各Habitの水平オフセット（結線の重なりを防ぐ）
    const HABIT_VERTICAL_GAP = 50;
    const MIN_HORIZONTAL_GAP = 300; // Goal間の水平間隔
    const ROOT_GOAL_X_START = 50; // ルートGoalの開始X座標（左寄せ）

    // サブツリーの高さを計算（縦配置用）
    function calculateSubtreeHeight(goalId: string): number {
      const children = goalChildren.get(goalId) || [];
      const habitsInGoal = habitsByGoal.get(goalId) || [];
      
      // このGoalのHabit領域の高さを計算
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
      
      // 子Goalsの高さを計算
      let childrenHeight = 0;
      if (children.length > 0) {
        children.forEach(childId => {
          childrenHeight += calculateSubtreeHeight(childId);
        });
      }
      
      // Goal自体の高さ + Habit領域 + 子Goals領域 + 間隔
      const goalHeight = 100; // Goal自体の高さ
      const totalHeight = goalHeight + Math.max(habitAreaHeight, childrenHeight) + GOAL_VERTICAL_SPACING;
      
      return totalHeight;
    }

    // サブツリーの幅を計算（Habit領域も考慮）
    function calculateSubtreeWidth(goalId: string): number {
      const children = goalChildren.get(goalId) || [];
      const habitsInGoal = habitsByGoal.get(goalId) || [];
      
      // このGoalのHabit領域の幅を計算
      let habitAreaWidth = 0;
      if (habitsInGoal.length > 0) {
        // 最後のHabitの右端までの幅
        habitAreaWidth = HABIT_HORIZONTAL_OFFSET + (habitsInGoal.length - 1) * HABIT_INDEX_OFFSET + MAIN_GROUP_WIDTH;
      }
      
      // 子Goalsの幅を計算
      let childrenWidth = 0;
      if (children.length > 0) {
        childrenWidth = children.reduce((sum, childId) => {
          return sum + calculateSubtreeWidth(childId);
        }, 0) + (children.length - 1) * MIN_HORIZONTAL_GAP;
      }
      
      // Goal自体の幅、Habit領域、子Goals領域の最大値
      return Math.max(GOAL_WIDTH, habitAreaWidth, childrenWidth);
    }

    // Goalツリーを配置（縦配置対応）
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
        },
      });

      // Habits配置（Main-Subグループまたは単独）
      // 親Goalの右下に縦に並べる（各Habitの水平位置をずらして結線が重ならないようにする）
      let maxHabitY = goalY; // Habit領域の最大Y座標を追跡
      
      if (habitsInGoal.length > 0) {
        let habitY = goalY + HABIT_VERTICAL_OFFSET; // Goalの少し下から開始

        habitsInGoal.forEach((habit, index) => {
          // 各Habitの水平位置を大きくずらす（結線の直角部分が重ならないように）
          const habitX = goalX + HABIT_HORIZONTAL_OFFSET + (index * HABIT_INDEX_OFFSET);
          
          const subHabitIds = Array.from(mainToSubs.get(habit.id) || []);
          const subHabits = subHabitIds.map(id => habits.find(h => h.id === id)).filter(Boolean) as Habit[];
          const progressPercentage = calculateProgress(habit);

          if (subHabits.length > 0) {
            // Main-Subグループノードとして配置
            generatedNodes.push({
              id: `main-group-${habit.id}`,
              type: 'mainHabitGroupNode',
              position: { x: habitX, y: habitY },
              data: {
                mainHabit: habit,
                subHabits,
                goal,
                progressPercentage,
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
            // 通常のHabitノード
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

      // 子Goals配置（親のHabit領域の下に配置）
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

    // ルートGoalsから配置（縦方向に並べる）
    let currentY = 0;
    rootGoals.forEach((rootGoal) => {
      const endY = layoutGoalTree(rootGoal.id, 0, ROOT_GOAL_X_START, currentY);
      currentY = endY + ROOT_GOAL_VERTICAL_SPACING;
    });

    // Next関係のエッジのみ追加
    const addedEdgeKeys = new Set<string>();
    
    relations.forEach((rel, idx) => {
      if (rel.relation !== 'next') {
        return; // Next関係のみ処理
      }

      const edgeKey = `${rel.habitId}-${rel.relatedHabitId}-next`;
      if (addedEdgeKeys.has(edgeKey)) {
        return;
      }
      addedEdgeKeys.add(edgeKey);

      // sourceとtargetを決定（Main-Subグループの場合は調整）
      let source = mainToSubs.has(rel.habitId) ? `main-group-${rel.habitId}` : rel.habitId;
      let target = mainToSubs.has(rel.relatedHabitId) ? `main-group-${rel.relatedHabitId}` : rel.relatedHabitId;

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
  }, [habits, goals, relations, loading, calculateProgress]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  React.useEffect(() => {
    setFlowNodes(nodes);
    setFlowEdges(edges);
  }, [nodes, edges, setFlowNodes, setFlowEdges]);

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
          Goal & Habit関係性マップ
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

  // 埋め込みモードの場合
  if (embedded) {
    return (
      <div className="h-full w-full flex flex-col bg-white dark:bg-slate-900 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-purple-600" style={{ height: '2px' }}></div>
              <span className="text-slate-700 dark:text-slate-300">Goal階層</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 border-t-2 border-dashed border-purple-400"></div>
              <span className="text-slate-700 dark:text-slate-300">Goal→Habit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-green-500"></div>
              <span className="text-slate-700 dark:text-slate-300">→ Next</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 50, y: 50, zoom: 0.6 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'step',
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    );
  }

  // フルスクリーンモード（既存の実装）

  return (
    <div className="fixed inset-0 z-50 bg-black/30">
      <div className="h-full flex flex-col bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Goal & Habit関係性マップ
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Goalツリーと配下のHabit、Habit間の関係を視覚化
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl p-2"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-purple-600" style={{ height: '3px' }}></div>
              <span className="text-slate-700 dark:text-slate-300">Goal階層</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 border-t-2 border-dashed border-purple-400"></div>
              <span className="text-slate-700 dark:text-slate-300">Goal→Habit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-500" style={{ height: '3px' }}></div>
              <span className="text-slate-700 dark:text-slate-300">Sub→Main</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-purple-500"></div>
              <span className="text-slate-700 dark:text-slate-300">Sub→Main</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span className="text-slate-700 dark:text-slate-300">→ Next</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 50, y: 50, zoom: 0.6 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'step',
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export function HabitRelationMap(props: HabitRelationMapProps) {
  return (
    <ReactFlowProvider>
      <HabitRelationMapFlow {...props} />
    </ReactFlowProvider>
  );
}
