/**
 * Goal Enclosure Diagram Widget
 * 
 * A React Flow-based widget that displays Goals as rectangular enclosures
 * containing their associated Habits. Supports hierarchical relationships,
 * pan/zoom interactions, and click-to-edit functionality.
 * 
 * Requirements:
 * - 1.1: Display Goals as enclosures
 * - 2.1: Display Habits inside Goal enclosures
 * - 4.3: Support pan/zoom interactions
 * - 5.2: Integrate with Statistics section
 * - 5.3: Filter Goals based on visibility
 * - 5.4: Provide Edit Graph button
 */

'use client';

import React, { useMemo, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { GoalEnclosureNode } from './GoalEnclosure.Node';
import { HabitNode } from './GoalEnclosure.HabitNode';
import {
  calculateLayout,
  NODE_TYPES,
  type LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from '../utils/goalEnclosureLayout';
import type { Goal, Habit } from '../types';

// Register custom node types
const nodeTypes = {
  [NODE_TYPES.GOAL_ENCLOSURE]: GoalEnclosureNode,
  [NODE_TYPES.HABIT_NODE]: HabitNode,
};

export interface GoalEnclosureWidgetProps {
  /** Array of all Goals */
  goals: Goal[];
  /** Array of all Habits */
  habits: Habit[];
  /** Array of Goal IDs that should be visible */
  visibleGoalIds: string[];
  /** Callback when a Goal is clicked for editing */
  onGoalEdit?: (goalId: string) => void;
  /** Callback when a Habit is clicked for editing */
  onHabitEdit?: (habitId: string) => void;
  /** Callback when Edit Graph button is clicked */
  onEditGraph?: () => void;
  /** Optional custom layout configuration */
  layoutConfig?: Partial<LayoutConfig>;
  /** Whether to show the mini map */
  showMiniMap?: boolean;
  /** Whether to show the controls */
  showControls?: boolean;
  /** Class name for the container */
  className?: string;
}

/**
 * Inner component that uses React Flow hooks
 */
function GoalEnclosureFlowInner({
  goals,
  habits,
  visibleGoalIds,
  onGoalEdit,
  onHabitEdit,
  onEditGraph,
  layoutConfig,
  showMiniMap = false,
  showControls = true,
  className = '',
}: GoalEnclosureWidgetProps) {
  // Merge custom config with defaults
  const config = useMemo(
    () => ({ ...DEFAULT_LAYOUT_CONFIG, ...layoutConfig }),
    [layoutConfig]
  );

  // Calculate layout
  const layoutResult = useMemo(
    () => calculateLayout(goals, habits, visibleGoalIds, config),
    [goals, habits, visibleGoalIds, config]
  );

  // Initialize React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutResult.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutResult.edges);

  // Update nodes when layout changes
  useEffect(() => {
    setNodes(layoutResult.nodes);
    setEdges(layoutResult.edges);
  }, [layoutResult, setNodes, setEdges]);

  // Handle custom events for node clicks
  useEffect(() => {
    const handleGoalClick = (e: CustomEvent<{ goalId: string }>) => {
      onGoalEdit?.(e.detail.goalId);
    };

    const handleHabitClick = (e: CustomEvent<{ habitId: string }>) => {
      onHabitEdit?.(e.detail.habitId);
    };

    window.addEventListener('goalEnclosureClick', handleGoalClick as EventListener);
    window.addEventListener('habitNodeClick', handleHabitClick as EventListener);

    return () => {
      window.removeEventListener('goalEnclosureClick', handleGoalClick as EventListener);
      window.removeEventListener('habitNodeClick', handleHabitClick as EventListener);
    };
  }, [onGoalEdit, onHabitEdit]);

  // Calculate fit view options based on diagram dimensions
  // Use higher minZoom to make diagram fill the viewport
  const fitViewOptions = useMemo(() => ({
    padding: 0.05,  // Minimal padding to maximize space usage
    maxZoom: 3,     // Allow larger zoom
    minZoom: 0.5,   // Higher minimum zoom to prevent tiny diagrams
  }), []);

  const hasContent = nodes.length > 0;

  return (
    <div className={`goal-enclosure-widget h-full w-full ${className}`}>
      {/* Header with Edit Graph button */}
      {onEditGraph && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/50">
          <h3 className="text-base font-semibold text-slate-100">
            Goal Enclosure Diagram
          </h3>
          <button
            onClick={onEditGraph}
            className="
              px-4 py-2
              text-sm font-medium
              rounded-lg
              bg-slate-700 hover:bg-slate-600
              text-slate-100 hover:text-white
              border border-slate-600 hover:border-slate-500
              transition-all
              min-h-[40px]
              shadow-sm hover:shadow
            "
          >
            Edit Graph
          </button>
        </div>
      )}

      {/* React Flow container */}
      <div 
        className="flex-1"
        style={{ 
          height: onEditGraph ? 'calc(100% - 48px)' : '100%',
          minHeight: 200,
        }}
      >
        {hasContent ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={fitViewOptions}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnScroll
            zoomOnScroll
            panOnDrag
            preventScrolling={false}
            minZoom={0.3}
            maxZoom={3}
            attributionPosition="bottom-left"
          >
            <Background color="rgba(100, 116, 139, 0.3)" gap={20} size={1} />
            {showControls && (
              <Controls 
                showZoom
                showFitView
                showInteractive={false}
                position="bottom-right"
              />
            )}
            {showMiniMap && (
              <MiniMap
                nodeColor={(node) => {
                  if (node.type === NODE_TYPES.GOAL_ENCLOSURE) {
                    const depth = node.data?.depth ?? 0;
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7'];
                    return node.data?.isCompleted 
                      ? 'rgba(100, 116, 139, 0.5)' 
                      : colors[Math.min(depth, colors.length - 1)];
                  }
                  return node.data?.isCompleted 
                    ? '#22c55e' 
                    : '#64748b';
                }}
                maskColor="rgba(15, 23, 42, 0.7)"
                style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)' }}
                position="top-right"
              />
            )}
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full bg-slate-900/50">
            <div className="text-center p-6">
              <p className="text-base text-slate-300">No Goals to display</p>
              <p className="text-sm mt-2 text-slate-500">
                {visibleGoalIds.length === 0 
                  ? 'Select Goals to show in the diagram'
                  : 'No matching Goals found'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Goal Enclosure Diagram Widget
 * 
 * Wraps the inner component with ReactFlowProvider for proper hook usage.
 */
export function GoalEnclosureWidget(props: GoalEnclosureWidgetProps) {
  return (
    <ReactFlowProvider>
      <GoalEnclosureFlowInner {...props} />
    </ReactFlowProvider>
  );
}

export default GoalEnclosureWidget;
