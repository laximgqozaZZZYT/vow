/**
 * EditableMindmap Controls Component
 * 
 * Top panel with node type selector and zoom controls.
 */

import React, { memo } from 'react';

/** Props for ControlsPanel component */
interface ControlsPanelProps {
  /** Current node type to create */
  nodeType: 'habit' | 'goal';
  /** Current zoom level */
  zoomLevel: number;
  /** Callback to change node type */
  onNodeTypeChange: (type: 'habit' | 'goal') => void;
  /** Callback to zoom in */
  onZoomIn: () => void;
  /** Callback to zoom out */
  onZoomOut: () => void;
  /** Callback to fit view */
  onFitView: () => void;
  /** Callback when zoom slider changes */
  onZoomChange: (zoom: number) => void;
}

/**
 * Controls Panel Component
 * 
 * Provides node type selection and zoom controls.
 */
export const ControlsPanel = memo(function ControlsPanel({
  nodeType,
  zoomLevel,
  onNodeTypeChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  onZoomChange,
}: ControlsPanelProps) {
  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 border border-slate-200/50 dark:border-slate-700/50">
      <div className="flex items-center gap-3">
        {/* Node type selector */}
        <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          Create:
        </span>
        <button
          onClick={() => onNodeTypeChange('habit')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            nodeType === 'habit' 
              ? 'bg-blue-500 text-white' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          Habit
        </button>
        <button
          onClick={() => onNodeTypeChange('goal')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            nodeType === 'goal' 
              ? 'bg-purple-500 text-white' 
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          Goal
        </button>
        
        {/* Divider */}
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onZoomOut}
            className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            min="0.1"
            max="2"
            step="0.1"
            value={zoomLevel}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            className="w-24 h-1 bg-slate-300 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-0"
            title="Zoom"
            aria-label="Zoom level"
          />
          <button
            onClick={onZoomIn}
            className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            ＋
          </button>
          <button
            onClick={onFitView}
            className="px-2 py-1 text-xs rounded bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            title="Fit view"
            aria-label="Fit view"
          >
            ⊡
          </button>
        </div>
      </div>
    </div>
  );
});
