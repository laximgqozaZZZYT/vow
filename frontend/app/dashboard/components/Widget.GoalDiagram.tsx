import { useEffect, useRef, useMemo, useId, useState } from 'react';
import mermaid from 'mermaid';
import type { Goal, Habit } from '../types';

// Mermaid can throw "Diagram flowchart-v2 already registered" if initialized multiple times.
// Guard initialization so it's done only once per page runtime.
let mermaidInitialized = false;
function initMermaidOnce() {
  if (mermaidInitialized) return;
  try {
    if ((mermaid as any)?.initialize) {
      mermaid.initialize({ startOnLoad: false });
    }
  } catch {
    // ignore
  }
  mermaidInitialized = true;
}

interface GoalMermaidProps {
  goals: Goal[];
  habits?: Habit[];
  openGoals?: Record<string, boolean>;
  toggleGoal?: (id: string) => void;
  setGoalParent?: (goalId: string, parentId: string | null) => void;
  mergeGoals?: (sourceId: string, targetId: string) => void;
  showErrorDetails?: boolean; // New prop for showing detailed error info
  compact?: boolean; // New prop for compact styling
  onEditGraph?: () => void; // New prop for edit graph callback
  visibleGoalIds?: string[]; // New prop for goal visibility
}

// Unified GoalMermaid: generate a mermaid flowchart text and render with error handling
export default function GoalMermaid({ goals, showErrorDetails = false, compact = false, onEditGraph, visibleGoalIds }: GoalMermaidProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  
  const graph = useMemo(() => {
    // Filter goals by visibility
    const visibleGoals = visibleGoalIds 
      ? goals.filter(g => visibleGoalIds.includes(g.id))
      : goals;
      
    let s = 'flowchart TD\n';
    for (const g of visibleGoals) {
      const gid = `G_${String(g.id).replace(/[^a-zA-Z0-9_]/g, '_')}`;
      s += `  ${gid}["${String(g.name).replace(/"/g, '\\"')}"]\n`;
      if (g.parentId && visibleGoalIds?.includes(g.parentId)) {
        const pgid = `G_${String(g.parentId).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        s += `  ${pgid} --> ${gid}\n`;
      }
    }
    return s;
  }, [goals, visibleGoalIds]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;

    const formatErr = (e: any) => {
      if (!e) return 'Unknown error';
      if (typeof e === 'string') return e;
      if (e instanceof Error) return e.stack || e.message;
      if (typeof e?.message === 'string') return e.message;
      try { return JSON.stringify(e, null, 2); } catch { return String(e); }
    };

    const render = async () => {
      try {
        initMermaidOnce();
        setRenderError(null);

        if (cancelled) return;
        
        // Clear previous content
        el.innerHTML = '';

        // Create mermaid element
        const mermaidEl = document.createElement('div');
        mermaidEl.className = 'mermaid';
        mermaidEl.textContent = graph;
        el.appendChild(mermaidEl);

        // Try modern mermaid.run() first, then fallback to legacy methods
        const run = (mermaid as any)?.run;
        if (typeof run === 'function') {
          await run({ nodes: [mermaidEl] });
        } else {
          // Legacy fallback
          const api = (mermaid as any)?.mermaidAPI || (mermaid as any);
          if (api?.render) {
            const renderId = `${id}-svg`;
            const res = api.render(renderId, graph);
            const out = res && typeof (res as any).then === 'function' ? await res : res;
            if (cancelled) return;
            if (typeof out === 'string') el.innerHTML = out;
            else if (out && typeof out === 'object' && typeof (out as any).svg === 'string') el.innerHTML = (out as any).svg;
            else el.innerText = String(out);
          } else if (api?.init) {
            api.init(undefined, mermaidEl);
          } else {
            // Final fallback: show plain text
            el.innerText = graph;
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        const errorMsg = formatErr(e);
        setRenderError(errorMsg);
        el.innerText = showErrorDetails ? errorMsg : 'Failed to render diagram';
      }
    };

    render();
    return () => { cancelled = true; };
  }, [graph, id, showErrorDetails]);

  return (
    <div className={compact ? "min-w-0" : "relative"}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Goal Hierarchy</h3>
        {onEditGraph && (
          <button 
            className="rounded border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800" 
            onClick={onEditGraph}
          >
            Edit Graph
          </button>
        )}
      </div>
      <div 
        ref={containerRef} 
        className={compact 
          ? "min-w-0 rounded border border-zinc-100 bg-black/10 p-2 dark:border-slate-800 dark:bg-white/5" 
          : "overflow-auto border rounded p-2"
        } 
        style={{ minHeight: 120 }} 
      />
      {renderError && showErrorDetails ? (
        <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
          {renderError}
          <div className="mt-2 text-[11px] text-red-200/70">Fallback source:</div>
          <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] text-red-100/80">{graph}</pre>
        </div>
      ) : null}
    </div>
  );
}