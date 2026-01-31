"use client";

/**
 * AgentPanels View
 *
 * tmux-style grid layout for displaying multiple agent panes.
 * Supports various layouts: 2x2, 2x4, 3x3, 1x4, 4x2
 *
 * @module View.AgentPanels
 */

import { useState, useMemo, useCallback } from 'react';
import type { Agent, AgentLog, AgentTask, PanelLayout } from '../types/agent.types';
import { PANEL_LAYOUT_CONFIG } from '../types/agent.types';
import AgentPane from './Widget.AgentPane';

interface AgentPanelsProps {
  agents: Agent[];
  logs: AgentLog[];
  tasks: AgentTask[];
}

/**
 * Layout Selector Component
 */
function LayoutSelector({
  layout,
  onChange,
}: {
  layout: PanelLayout;
  onChange: (layout: PanelLayout) => void;
}) {
  const layouts: PanelLayout[] = ['2x2', '2x4', '3x3', '1x4', '4x2'];

  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5">
      {layouts.map((l) => {
        const config = PANEL_LAYOUT_CONFIG[l];
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`
              px-2 py-1 text-xs rounded
              transition-colors
              ${layout === l
                ? 'bg-primary text-primary-foreground'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }
            `}
            title={`${config.cols} x ${config.rows} layout`}
          >
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Agent Selector for Mobile
 */
function MobileAgentSelector({
  agents,
  selectedIndex,
  onChange,
}: {
  agents: Agent[];
  selectedIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
      {agents.map((agent, index) => (
        <button
          key={agent.id}
          onClick={() => onChange(index)}
          className={`
            shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
            transition-colors
            ${selectedIndex === index
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }
          `}
        >
          {agent.name}
        </button>
      ))}
    </div>
  );
}

/**
 * AgentPanels Component
 */
export default function AgentPanels({ agents, logs, tasks }: AgentPanelsProps) {
  const [layout, setLayout] = useState<PanelLayout>('2x2');
  const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);
  const [mobileSelectedIndex, setMobileSelectedIndex] = useState(0);

  const layoutConfig = PANEL_LAYOUT_CONFIG[layout];
  const totalPanes = layoutConfig.cols * layoutConfig.rows;

  // Assign agents to panes
  const paneAgents = useMemo(() => {
    const result: (Agent | null)[] = [];
    for (let i = 0; i < totalPanes; i++) {
      result.push(agents[i] || null);
    }
    return result;
  }, [agents, totalPanes]);

  // Get task title for an agent
  const getTaskTitle = useCallback((agent: Agent | null): string | undefined => {
    if (!agent || !agent.currentTaskId) return undefined;
    const task = tasks.find((t) => t.id === agent.currentTaskId);
    return task?.title;
  }, [tasks]);

  // Handle maximize/minimize
  const handleMaximize = (index: number) => setMaximizedPaneIndex(index);
  const handleMinimize = () => setMaximizedPaneIndex(null);

  // Grid style based on layout
  const getGridStyle = () => {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${layoutConfig.cols}, 1fr)`,
      gridTemplateRows: `repeat(${layoutConfig.rows}, 1fr)`,
      gap: '0.5rem',
    };
  };

  // Mobile: swipe handling
  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      setMobileSelectedIndex((prev) => Math.min(prev + 1, agents.length - 1));
    } else {
      setMobileSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  // Touch handling for swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > 50) {
      handleSwipe(diff > 0 ? 'left' : 'right');
    }
    setTouchStart(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{agents.length}</span> agents active
        </div>
        {/* Desktop: Layout selector */}
        <div className="hidden sm:block">
          <LayoutSelector layout={layout} onChange={setLayout} />
        </div>
      </div>

      {/* Mobile: Agent selector */}
      <div className="sm:hidden mb-3 shrink-0">
        <MobileAgentSelector
          agents={agents}
          selectedIndex={mobileSelectedIndex}
          onChange={setMobileSelectedIndex}
        />
      </div>

      {/* Desktop: Grid Layout */}
      <div
        className="hidden sm:grid flex-1 min-h-0"
        style={getGridStyle()}
      >
        {maximizedPaneIndex !== null ? (
          // Show only maximized pane
          <div className="col-span-full row-span-full">
            <AgentPane
              agent={paneAgents[maximizedPaneIndex]}
              logs={logs}
              isMaximized={true}
              onMinimize={handleMinimize}
              currentTaskTitle={getTaskTitle(paneAgents[maximizedPaneIndex])}
            />
          </div>
        ) : (
          // Show all panes
          paneAgents.map((agent, index) => (
            <AgentPane
              key={agent?.id || `empty-${index}`}
              agent={agent}
              logs={logs}
              isMaximized={false}
              onMaximize={() => handleMaximize(index)}
              currentTaskTitle={getTaskTitle(agent)}
            />
          ))
        )}
      </div>

      {/* Mobile: Single pane with swipe */}
      <div
        className="sm:hidden flex-1 min-h-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AgentPane
          agent={agents[mobileSelectedIndex] || null}
          logs={logs}
          currentTaskTitle={getTaskTitle(agents[mobileSelectedIndex])}
        />
      </div>

      {/* Mobile: Pagination dots */}
      <div className="sm:hidden flex items-center justify-center gap-1.5 mt-3 shrink-0">
        {agents.map((_, index) => (
          <button
            key={index}
            onClick={() => setMobileSelectedIndex(index)}
            className={`
              w-2 h-2 rounded-full transition-colors
              ${mobileSelectedIndex === index
                ? 'bg-primary'
                : 'bg-gray-600 hover:bg-gray-500'
              }
            `}
            aria-label={`Go to agent ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
