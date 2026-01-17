"use client"

import React, { useState, useCallback, useRef } from "react"
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
  Handle,
  Position,
  NodeProps,
  MarkerType,
  useReactFlow,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabaseDirectClient } from '../../../lib/supabase-direct'
import type { Habit, Goal } from '../types'
import { HabitForm } from './Form.Habit'
import { GoalForm } from './Form.Goal'

interface EditableMindmapProps {
  habits: Habit[];
  goals: Goal[];
  onClose: () => void;
  onRegisterAsHabit: (data: any) => Promise<any>;
  onRegisterAsGoal: (data: any) => Promise<any>;
}

interface HabitNodeData {
  habit: Habit;
  goal?: Goal;
  progressPercentage: number;
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

  const handleClass = isMobile ? "w-6 h-6 bg-purple-500 border-2 border-white" : "w-3 h-3 bg-purple-500";

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className={handleClass} />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
      <Handle type="source" position={Position.Right} id="right" className={handleClass} />
      <Handle type="target" position={Position.Left} id="left" className={handleClass} />
      
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

  const handleClass = isMobile ? "w-6 h-6 bg-blue-500 border-2 border-white" : "w-3 h-3 bg-blue-500";

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className={handleClass} />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
      <Handle type="target" position={Position.Left} className={handleClass} />
      <Handle type="source" position={Position.Right} className={handleClass} />
      
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

const nodeTypes = {
  habitNode: EditableHabitNode,
  goalNode: EditableGoalNode,
};

function EditableMindmapFlow({ habits, goals, onClose, onRegisterAsHabit, onRegisterAsGoal }: EditableMindmapProps) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [nodeType, setNodeType] = useState<'habit' | 'goal'>('habit');
  const [connectionStartInfo, setConnectionStartInfo] = useState<{nodeId: string, handleId?: string} | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [detailViewMode, setDetailViewMode] = useState<'normal' | 'detail'>('normal');
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();

  // Load tags
  React.useEffect(() => {
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

  // 初期ノードとエッジの生成
  React.useEffect(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    goals.forEach((goal, index) => {
      const habitsInGoal = habits.filter(h => h.goalId === goal.id);
      const completedHabits = habitsInGoal.filter(h => h.completed).length;

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
        },
      });

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
          },
        });

        initialEdges.push({
          id: `edge-goal-${goal.id}-habit-${habit.id}`,
          source: `goal-${goal.id}`,
          target: `habit-${habit.id}`,
          style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
          type: 'step',
        });
      });

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

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  const onConnectStart = useCallback(
    (event: React.MouseEvent | React.TouchEvent, { nodeId, handleId }: { nodeId: string; handleId?: string }) => {
      setConnectionStartInfo({ nodeId, handleId });
    },
    []
  );

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
          const sourceGoalData = sourceNode?.data as GoalNodeData;
          const sourceGoalId = sourceGoalData?.goal?.id;
          
          if (nodeType === 'goal') {
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
              id: `edge-${connectionStartInfo.nodeId}-${newNode.id}`,
              source: connectionStartInfo.nodeId,
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
              id: `edge-${connectionStartInfo.nodeId}-${newNode.id}`,
              source: connectionStartInfo.nodeId,
              target: newNode.id,
              style: { stroke: '#a855f7', strokeWidth: 2, strokeDasharray: '5,5' },
              type: 'step',
            };
            
            setFlowEdges((eds) => eds.concat(newEdge));
          }
        } else if (sourceNodeType === 'habitNode') {
          const sourceHabitData = sourceNode?.data as HabitNodeData;
          const sourceHabitId = sourceHabitData?.habit?.id;
          const sourceGoalId = sourceHabitData?.habit?.goalId;
          
          if (nodeType === 'habit') {
            const newHabitPayload = {
              name: 'New Habit',
              goalId: sourceGoalId,
              type: 'do',
              must: 1,
            };
            
            const createdHabit = await onRegisterAsHabit(newHabitPayload);
            
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
              id: `edge-${connectionStartInfo.nodeId}-${newNode.id}`,
              source: connectionStartInfo.nodeId,
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
          }
        }
      }
      
      setConnectionStartInfo(null);
    },
    [project, setFlowNodes, setFlowEdges, connectionStartInfo, nodeType, flowNodes, onRegisterAsGoal, onRegisterAsHabit]
  );

  // Handle form save
  const handleHabitSave = useCallback(async (habitData: any) => {
    if (!selectedNode || selectedNode.type !== 'habitNode') return;
    
    const habitNodeData = selectedNode.data as HabitNodeData;
    const habitId = habitNodeData.habit.id;
    
    try {
      await supabaseDirectClient.updateHabit(habitId, habitData);
      
      // Update local state
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

  const handleGoalSave = useCallback(async (goalData: any) => {
    if (!selectedNode || selectedNode.type !== 'goalNode') return;
    
    const goalNodeData = selectedNode.data as GoalNodeData;
    const goalId = goalNodeData.goal.id;
    
    try {
      await supabaseDirectClient.updateGoal(goalId, goalData);
      
      // Update local state
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

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Editable Mindmap
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
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 50, y: 50, zoom: 0.8 }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls />
          
          <Panel position="top-center" className="mt-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg px-4 py-2 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">Create:</span>
                <button
                  onClick={() => setNodeType('habit')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${nodeType === 'habit' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                >
                  Habit
                </button>
                <button
                  onClick={() => setNodeType('goal')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${nodeType === 'goal' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                >
                  Goal
                </button>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* 詳細パネル - 画面下部 */}
      {selectedNode && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg max-h-[50vh] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                ✕ Close
              </button>
            </div>

            {selectedNode.type === 'goalNode' ? (
              <GoalForm
                goal={(selectedNode.data as GoalNodeData).goal}
                goals={goals}
                tags={tags}
                viewMode={detailViewMode}
                onViewModeChange={setDetailViewMode}
                onSave={handleGoalSave}
              />
            ) : (
              <HabitForm
                habit={(selectedNode.data as HabitNodeData).habit}
                goals={goals}
                tags={tags}
                viewMode={detailViewMode}
                onViewModeChange={setDetailViewMode}
                onSave={handleHabitSave}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EditableMindmap(props: EditableMindmapProps) {
  return (
    <ReactFlowProvider>
      <EditableMindmapFlow {...props} />
    </ReactFlowProvider>
  );
}
