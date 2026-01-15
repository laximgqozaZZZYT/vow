"use client";

import { useState, useEffect } from 'react';
import { useAnimationCapture } from '../utils/animationCapture';
import { debug } from '../../../lib/debug';
import type { AnimationSequence } from '../utils/animationCapture';

interface AnimationCaptureControlProps {
  className?: string;
}

export default function AnimationCaptureControl({ className = '' }: AnimationCaptureControlProps) {
  const { 
    startCapture, 
    stopCapture, 
    isCapturing, 
    getStoredSequences, 
    clearSequences 
  } = useAnimationCapture();
  
  const [sequences, setSequences] = useState<AnimationSequence[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showSequences, setShowSequences] = useState(false);

  useEffect(() => {
    setIsRecording(isCapturing());
    setSequences(getStoredSequences());
  }, [isCapturing, getStoredSequences]);

  const handleStartCapture = () => {
    const captureId = startCapture('Dashboard Demo');
    setIsRecording(true);
    debug.log('[AnimationCaptureControl] Started capture:', captureId);
  };

  const handleStopCapture = () => {
    const sequence = stopCapture();
    setIsRecording(false);
    if (sequence) {
      setSequences(prev => [...prev, sequence]);
      debug.log('[AnimationCaptureControl] Stopped capture, sequence:', sequence);
    }
  };

  const handleClearSequences = () => {
    clearSequences();
    setSequences([]);
  };

  const exportSequence = (sequence: AnimationSequence) => {
    const dataStr = JSON.stringify(sequence, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `dashboard-animation-${sequence.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Animation Capture
        </h3>
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 text-red-600">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={isRecording ? handleStopCapture : handleStartCapture}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isRecording ? '⏹️ Stop Recording' : '🎬 Start Recording'}
        </button>
        
        <button
          onClick={() => setShowSequences(!showSequences)}
          className="px-4 py-2 rounded-md text-sm font-medium bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-zinc-50"
        >
          📋 Sequences ({sequences.length})
        </button>
        
        {sequences.length > 0 && (
          <button
            onClick={handleClearSequences}
            className="px-4 py-2 rounded-md text-sm font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-700 dark:text-red-300"
          >
            🗑️ Clear All
          </button>
        )}
      </div>

      {showSequences && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <h4 className="text-md font-medium text-zinc-900 dark:text-zinc-50 mb-3">
            Captured Sequences
          </h4>
          
          {sequences.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No sequences captured yet. Start recording to capture dashboard interactions.
            </p>
          ) : (
            <div className="space-y-3">
              {sequences.map((sequence) => (
                <div
                  key={sequence.id}
                  className="bg-zinc-50 dark:bg-zinc-800 rounded-md p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {sequence.name}
                    </h5>
                    <button
                      onClick={() => exportSequence(sequence)}
                      className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded"
                    >
                      Export
                    </button>
                  </div>
                  
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                    <div>Steps: {sequence.steps.length}</div>
                    <div>Duration: {(sequence.totalDuration / 1000).toFixed(1)}s</div>
                    <div>Created: {new Date(sequence.createdAt).toLocaleString()}</div>
                  </div>
                  
                  <div className="mt-2">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50">
                        View Steps ({sequence.steps.length})
                      </summary>
                      <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                        {sequence.steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="text-xs bg-white dark:bg-zinc-900 p-2 rounded border"
                          >
                            <div className="font-medium">
                              {index + 1}. {step.type} - {step.action}
                            </div>
                            <div className="text-zinc-500 dark:text-zinc-400">
                              {step.data.habitName || step.data.goalName || 'Calendar Action'}
                            </div>
                            <div className="text-zinc-400 dark:text-zinc-500">
                              {(step.timestamp / 1000).toFixed(1)}s
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isRecording && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Recording in progress:</strong> Interact with habits, goals, and calendar to capture animations. 
            Click "Stop Recording" when finished.
          </p>
        </div>
      )}
    </div>
  );
}