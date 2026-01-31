"use client";

/**
 * InstructionFlow Widget Component
 *
 * Visualizes the instruction flow between agents using SVG.
 * Shows Manager -> Worker relationships with animated edges.
 *
 * @module Widget.InstructionFlow
 */

import { useState, useMemo, useCallback } from 'react';
import type { Agent, AgentInstruction, InstructionStatus } from '../types/agent.types';
import { ROLE_CONFIG, STATUS_CONFIG, INSTRUCTION_STATUS_CONFIG } from '../types/agent.types';

interface InstructionFlowProps {
  agents: Agent[];
  instructions: AgentInstruction[];
  onNodeClick?: (agentId: string) => void;
  onEdgeClick?: (instruction: AgentInstruction) => void;
  className?: string;
}

interface FlowNode {
  id: string;
  agent: Agent;
  x: number;
  y: number;
  level: number;
}

interface FlowEdge {
  id: string;
  from: FlowNode;
  to: FlowNode;
  instruction: AgentInstruction;
}

// Node dimensions
const NODE_WIDTH = 100;
const NODE_HEIGHT = 60;
const LEVEL_GAP = 100;
const NODE_GAP = 20;

/**
 * Calculate node positions based on agent roles
 */
function calculateLayout(agents: Agent[], instructions: AgentInstruction[]): FlowNode[] {
  // Group agents by role/level
  const managers = agents.filter(a => a.role === 'manager');
  const developers = agents.filter(a => a.role === 'developer');
  const testers = agents.filter(a => a.role === 'tester');
  const reviewers = agents.filter(a => a.role === 'reviewer');
  const others = agents.filter(a =>
    !['manager', 'developer', 'tester', 'reviewer'].includes(a.role)
  );

  const levels = [
    { level: 0, agents: managers },
    { level: 1, agents: [...developers, ...others] },
    { level: 2, agents: [...testers, ...reviewers] },
  ];

  const nodes: FlowNode[] = [];

  // Calculate max width for centering
  const maxAgentsInLevel = Math.max(...levels.map(l => l.agents.length));
  const totalWidth = maxAgentsInLevel * (NODE_WIDTH + NODE_GAP) - NODE_GAP;

  levels.forEach(({ level, agents: levelAgents }) => {
    const levelWidth = levelAgents.length * (NODE_WIDTH + NODE_GAP) - NODE_GAP;
    const startX = (totalWidth - levelWidth) / 2;
    const y = level * LEVEL_GAP + 40;

    levelAgents.forEach((agent, index) => {
      nodes.push({
        id: agent.id,
        agent,
        x: startX + index * (NODE_WIDTH + NODE_GAP) + NODE_WIDTH / 2,
        y: y + NODE_HEIGHT / 2,
        level,
      });
    });
  });

  return nodes;
}

/**
 * Create edges from instructions
 */
function createEdges(nodes: FlowNode[], instructions: AgentInstruction[]): FlowEdge[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return instructions
    .map(instruction => {
      const from = nodeMap.get(instruction.fromAgentId);
      const to = nodeMap.get(instruction.toAgentId);

      if (!from || !to) return null;

      return {
        id: instruction.id,
        from,
        to,
        instruction,
      };
    })
    .filter((edge): edge is FlowEdge => edge !== null);
}

/**
 * SVG Arrow marker definition - Improved design with gradient fill
 */
function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      markerWidth="12"
      markerHeight="8"
      refX="10"
      refY="4"
      orient="auto"
    >
      <path
        d="M 0 0 L 12 4 L 0 8 L 3 4 Z"
        fill={color}
        opacity="0.9"
      />
    </marker>
  );
}

/**
 * Gradient definitions for flow edges
 */
function FlowGradients() {
  return (
    <>
      {/* Pending edge gradient - subtle pulse effect */}
      <linearGradient id="gradient-pending" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#94a3b8" stopOpacity="1" />
      </linearGradient>
      {/* Delivered edge gradient - blue tones */}
      <linearGradient id="gradient-delivered" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#60a5fa" stopOpacity="1" />
      </linearGradient>
      {/* Acknowledged edge gradient - yellow tones */}
      <linearGradient id="gradient-acknowledged" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
      </linearGradient>
      {/* Completed edge gradient - green tones */}
      <linearGradient id="gradient-completed" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
      </linearGradient>
      {/* Failed edge gradient - red tones */}
      <linearGradient id="gradient-failed" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#f87171" stopOpacity="1" />
      </linearGradient>
      {/* Node shadow filter */}
      <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.2" />
      </filter>
    </>
  );
}

/**
 * Flow Edge Component - Enhanced with smooth cubic Bezier curves
 */
function FlowEdgeComponent({
  edge,
  isSelected,
  onClick,
}: {
  edge: FlowEdge;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { from, to, instruction } = edge;
  const statusConfig = INSTRUCTION_STATUS_CONFIG[instruction.status];

  // Offset start and end points from node centers
  const startY = from.y + NODE_HEIGHT / 2 - 5;
  const endY = to.y - NODE_HEIGHT / 2 + 5;

  // Calculate smooth S-curve using cubic Bezier
  // Control points create elegant curves that flow naturally
  const c1x = from.x;
  const c1y = startY + (endY - startY) * 0.4;
  const c2x = to.x;
  const c2y = startY + (endY - startY) * 0.6;

  const path = `M ${from.x} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${endY}`;

  // Midpoint for status indicator
  const midX = (from.x + to.x) / 2;
  const midY = (startY + endY) / 2;

  const markerId = `arrow-${instruction.status}`;
  const gradientId = `gradient-${instruction.status}`;
  const isPending = instruction.status === 'pending';
  const isAcknowledged = instruction.status === 'acknowledged';

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* Hover/click area - wider for easier interaction */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="24"
      />
      {/* Glow effect for selected edge */}
      {isSelected && (
        <path
          d={path}
          fill="none"
          stroke={statusConfig.strokeColor}
          strokeWidth="6"
          strokeOpacity="0.3"
          strokeLinecap="round"
        />
      )}
      {/* Main visible path with gradient */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={isSelected ? 3 : 2}
        strokeLinecap="round"
        strokeDasharray={isPending ? '8,6' : undefined}
        markerEnd={`url(#${markerId})`}
        className={`transition-all duration-300`}
        style={{
          // Animated dash offset for pending edges (flowing effect)
          ...(isPending && {
            animation: 'dashFlow 1.5s linear infinite',
          }),
          // Pulse effect for acknowledged edges
          ...(isAcknowledged && {
            animation: 'edgePulse 2s ease-in-out infinite',
          }),
        }}
      />
      {/* Status indicator dot with shadow */}
      <circle
        cx={midX}
        cy={midY}
        r={isSelected ? 6 : 5}
        fill={statusConfig.strokeColor}
        className={`transition-all duration-200 ${isSelected ? 'opacity-100' : 'opacity-70'}`}
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
      />
      {/* Inner highlight for status dot */}
      <circle
        cx={midX}
        cy={midY}
        r={isSelected ? 3 : 2}
        fill="white"
        opacity="0.4"
      />
    </g>
  );
}

/**
 * Flow Node Component - Enhanced with shadows and better styling
 */
function FlowNodeComponent({
  node,
  isSelected,
  onClick,
}: {
  node: FlowNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { agent } = node;
  const roleConfig = ROLE_CONFIG[agent.role];
  const statusConfig = STATUS_CONFIG[agent.status];

  const x = node.x - NODE_WIDTH / 2;
  const y = node.y - NODE_HEIGHT / 2;

  return (
    <g
      className="cursor-pointer"
      onClick={onClick}
      style={{ filter: 'url(#node-shadow)' }}
    >
      {/* Selection highlight ring */}
      {isSelected && (
        <rect
          x={x - 3}
          y={y - 3}
          width={NODE_WIDTH + 6}
          height={NODE_HEIGHT + 6}
          rx={11}
          ry={11}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="stroke-primary opacity-50"
        />
      )}

      {/* Node background with gradient */}
      <rect
        x={x}
        y={y}
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        ry={8}
        className={`
          fill-card stroke-border
          transition-all duration-200
          ${isSelected ? 'stroke-primary stroke-2' : 'stroke-1'}
          ${agent.status === 'offline' ? 'opacity-50' : ''}
        `}
      />

      {/* Status indicator with glow */}
      <circle
        cx={x + NODE_WIDTH - 8}
        cy={y + 8}
        r={5}
        className={statusConfig.bgColor}
        style={{
          filter: agent.status !== 'offline' ? 'drop-shadow(0 0 3px currentColor)' : undefined,
        }}
      />
      {/* Status indicator inner highlight */}
      <circle
        cx={x + NODE_WIDTH - 9}
        cy={y + 7}
        r={1.5}
        fill="white"
        opacity="0.5"
      />

      {/* Role icon */}
      <text
        x={node.x}
        y={y + 22}
        textAnchor="middle"
        className="text-base"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))' }}
      >
        {roleConfig.icon}
      </text>

      {/* Agent name */}
      <text
        x={node.x}
        y={y + 42}
        textAnchor="middle"
        className="fill-foreground text-[10px] font-medium"
      >
        {agent.name.length > 12 ? agent.name.slice(0, 10) + '..' : agent.name}
      </text>

      {/* Role label */}
      <text
        x={node.x}
        y={y + 54}
        textAnchor="middle"
        className="fill-muted-foreground text-[8px]"
      >
        {roleConfig.label}
      </text>
    </g>
  );
}

/**
 * Instruction Detail Panel
 */
function InstructionDetail({
  instruction,
  agents,
  onClose,
}: {
  instruction: AgentInstruction;
  agents: Agent[];
  onClose: () => void;
}) {
  const fromAgent = agents.find(a => a.id === instruction.fromAgentId);
  const toAgent = agents.find(a => a.id === instruction.toAgentId);
  const statusConfig = INSTRUCTION_STATUS_CONFIG[instruction.status];

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="absolute bottom-2 left-2 right-2 bg-card border border-border rounded-lg p-3 shadow-lg z-10">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${statusConfig.color}`}>
              {statusConfig.labelJa}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(instruction.timestamp)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-1">
            {fromAgent?.name || 'Unknown'} → {toAgent?.name || 'Unknown'}
          </div>
          <p className="text-xs line-clamp-2">{instruction.content}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors shrink-0"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/**
 * Legend Component
 */
function Legend() {
  const statuses: InstructionStatus[] = ['pending', 'delivered', 'acknowledged', 'completed', 'failed'];

  return (
    <div className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm border border-border rounded-md p-2 text-xs">
      <div className="text-muted-foreground mb-1 font-medium">Status</div>
      <div className="space-y-1">
        {statuses.map(status => {
          const config = INSTRUCTION_STATUS_CONFIG[status];
          return (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: config.strokeColor }}
              />
              <span className="text-muted-foreground">{config.labelJa}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * InstructionFlow Widget Component
 */
export default function InstructionFlow({
  agents,
  instructions,
  onNodeClick,
  onEdgeClick,
  className = '',
}: InstructionFlowProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedInstruction, setSelectedInstruction] = useState<AgentInstruction | null>(null);

  // Calculate layout
  const nodes = useMemo(() => calculateLayout(agents, instructions), [agents, instructions]);
  const edges = useMemo(() => createEdges(nodes, instructions), [nodes, instructions]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    if (nodes.length === 0) return '0 0 400 300';

    const padding = 40;
    const minX = Math.min(...nodes.map(n => n.x - NODE_WIDTH / 2)) - padding;
    const maxX = Math.max(...nodes.map(n => n.x + NODE_WIDTH / 2)) + padding;
    const minY = 0;
    const maxY = Math.max(...nodes.map(n => n.y + NODE_HEIGHT / 2)) + padding;

    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  }, [nodes]);

  const handleNodeClick = useCallback((agentId: string) => {
    setSelectedNodeId(prev => prev === agentId ? null : agentId);
    setSelectedInstruction(null);
    onNodeClick?.(agentId);
  }, [onNodeClick]);

  const handleEdgeClick = useCallback((instruction: AgentInstruction) => {
    setSelectedInstruction(prev => prev?.id === instruction.id ? null : instruction);
    setSelectedNodeId(null);
    onEdgeClick?.(instruction);
  }, [onEdgeClick]);

  if (agents.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground ${className}`}>
        No agents to display
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* CSS animations for edge effects */}
      <style>{`
        @keyframes dashFlow {
          from { stroke-dashoffset: 14; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes edgePulse {
          0%, 100% { stroke-opacity: 0.7; }
          50% { stroke-opacity: 1; }
        }
      `}</style>
      <svg
        viewBox={viewBox}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Gradient definitions for visual depth */}
          <FlowGradients />
          {/* Arrow markers for each status */}
          {(['pending', 'delivered', 'acknowledged', 'completed', 'failed'] as InstructionStatus[]).map(status => (
            <ArrowMarker
              key={status}
              id={`arrow-${status}`}
              color={INSTRUCTION_STATUS_CONFIG[status].strokeColor}
            />
          ))}
        </defs>

        {/* Edges */}
        <g className="edges">
          {edges.map(edge => (
            <FlowEdgeComponent
              key={edge.id}
              edge={edge}
              isSelected={selectedInstruction?.id === edge.instruction.id}
              onClick={() => handleEdgeClick(edge.instruction)}
            />
          ))}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {nodes.map(node => (
            <FlowNodeComponent
              key={node.id}
              node={node}
              isSelected={selectedNodeId === node.id}
              onClick={() => handleNodeClick(node.id)}
            />
          ))}
        </g>
      </svg>

      {/* Legend */}
      <Legend />

      {/* Instruction Detail Panel */}
      {selectedInstruction && (
        <InstructionDetail
          instruction={selectedInstruction}
          agents={agents}
          onClose={() => setSelectedInstruction(null)}
        />
      )}
    </div>
  );
}
