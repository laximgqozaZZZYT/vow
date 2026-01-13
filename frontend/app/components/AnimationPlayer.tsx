"use client";

import { useState, useEffect, useRef } from 'react';
import type { AnimationSequence, AnimationStep } from '../dashboard/utils/animationCapture';

interface AnimationPlayerProps {
  sequence: AnimationSequence;
  onComplete?: () => void;
  className?: string;
}

export default function AnimationPlayer({ sequence, onComplete, className = '' }: AnimationPlayerProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = currentStepIndex >= 0 ? sequence.steps[currentStepIndex] : null;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const playNextStep = () => {
    if (currentStepIndex >= sequence.steps.length - 1) {
      // Animation complete
      setIsPlaying(false);
      setCurrentStepIndex(-1);
      if (onComplete) onComplete();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    const nextStep = sequence.steps[nextIndex];
    
    setCurrentStepIndex(nextIndex);

    // Calculate delay to next step
    const currentTime = currentStepIndex >= 0 ? sequence.steps[currentStepIndex].timestamp : 0;
    const nextTime = nextStep.timestamp;
    const delay = Math.max(100, (nextTime - currentTime) / playbackSpeed);

    timeoutRef.current = setTimeout(() => {
      playNextStep();
    }, delay);
  };

  const startPlayback = () => {
    if (isPlaying) return;
    
    setIsPlaying(true);
    setCurrentStepIndex(-1);
    
    // Start with first step after a short delay
    timeoutRef.current = setTimeout(() => {
      playNextStep();
    }, 500);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setCurrentStepIndex(-1);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const resetPlayback = () => {
    stopPlayback();
  };

  const renderStepVisualization = (step: AnimationStep) => {
    const getStepColor = (type: string) => {
      switch (type) {
        case 'habit': return 'bg-green-500';
        case 'goal': return 'bg-blue-500';
        case 'calendar': return 'bg-purple-500';
        default: return 'bg-gray-500';
      }
    };

    const getActionIcon = (type: string, action: string) => {
      if (type === 'habit') {
        switch (action) {
          case 'start': return '▶️';
          case 'complete': return '✅';
          case 'pause': return '⏸️';
          default: return '🔄';
        }
      } else if (type === 'goal') {
        switch (action) {
          case 'create': return '➕';
          case 'update': return '✏️';
          case 'complete': return '🎯';
          case 'delete': return '🗑️';
          default: return '🔄';
        }
      } else if (type === 'calendar') {
        switch (action) {
          case 'eventClick': return '👆';
          case 'slotSelect': return '📅';
          case 'eventChange': return '🔄';
          default: return '📅';
        }
      }
      return '🔄';
    };

    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border-l-4 border-l-blue-500">
        <div className={`w-8 h-8 rounded-full ${getStepColor(step.type)} flex items-center justify-center text-white text-sm`}>
          {getActionIcon(step.type, step.action)}
        </div>
        <div className="flex-1">
          <div className="font-medium text-sm text-zinc-900 dark:text-zinc-50">
            {step.type.charAt(0).toUpperCase() + step.type.slice(1)} - {step.action}
          </div>
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            {step.data.habitName || step.data.goalName || 'Calendar Action'}
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {(step.timestamp / 1000).toFixed(1)}s
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 ${className}`} ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Animation Player
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50"
            disabled={isPlaying}
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          {sequence.name} - {sequence.steps.length} steps, {(sequence.totalDuration / 1000).toFixed(1)}s
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isPlaying ? '⏹️ Stop' : '▶️ Play'}
          </button>
          
          <button
            onClick={resetPlayback}
            className="px-4 py-2 rounded-md text-sm font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50"
            disabled={isPlaying}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${currentStepIndex >= 0 ? ((currentStepIndex + 1) / sequence.steps.length) * 100 : 0}%`
            }}
          />
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Step {Math.max(0, currentStepIndex + 1)} of {sequence.steps.length}
        </div>
      </div>

      {/* Current step display */}
      {currentStep && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">
            Current Step:
          </h4>
          {renderStepVisualization(currentStep)}
        </div>
      )}

      {/* All steps list */}
      <div>
        <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">
          Animation Steps:
        </h4>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {sequence.steps.map((step, index) => (
            <div
              key={step.id}
              className={`transition-all duration-300 ${
                index === currentStepIndex
                  ? 'ring-2 ring-blue-500 ring-opacity-50'
                  : index < currentStepIndex
                  ? 'opacity-60'
                  : ''
              }`}
            >
              {renderStepVisualization(step)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}