/**
 * Dashboard Animation Capture Utility
 * Captures user interactions on dashboard for mini-animation generation
 */

export interface AnimationStep {
  id: string;
  timestamp: number;
  type: 'habit' | 'goal' | 'calendar';
  action: string;
  element: string;
  data: Record<string, any>;
  position?: { x: number; y: number };
  duration?: number;
}

export interface AnimationSequence {
  id: string;
  name: string;
  steps: AnimationStep[];
  totalDuration: number;
  createdAt: number;
}

class AnimationCaptureManager {
  private isCapturing = false;
  private currentSequence: AnimationStep[] = [];
  private sequenceStartTime = 0;
  private captureId = '';

  startCapture(sequenceName: string): string {
    this.captureId = `capture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.isCapturing = true;
    this.currentSequence = [];
    this.sequenceStartTime = Date.now();
    
    console.log(`[AnimationCapture] Started capturing: ${sequenceName} (${this.captureId})`);
    return this.captureId;
  }

  stopCapture(): AnimationSequence | null {
    if (!this.isCapturing) return null;

    this.isCapturing = false;
    const totalDuration = Date.now() - this.sequenceStartTime;
    
    const sequence: AnimationSequence = {
      id: this.captureId,
      name: `Dashboard Sequence ${new Date().toLocaleTimeString()}`,
      steps: [...this.currentSequence],
      totalDuration,
      createdAt: Date.now()
    };

    console.log(`[AnimationCapture] Stopped capturing. Sequence:`, sequence);
    
    // Store in localStorage for later use
    this.saveSequence(sequence);
    
    return sequence;
  }

  captureHabitAction(habitId: string, action: 'start' | 'complete' | 'pause', element: HTMLElement, data?: Record<string, any>) {
    if (!this.isCapturing) return;

    const rect = element.getBoundingClientRect();
    const step: AnimationStep = {
      id: `step_${this.currentSequence.length + 1}`,
      timestamp: Date.now() - this.sequenceStartTime,
      type: 'habit',
      action,
      element: this.getElementSelector(element),
      data: {
        habitId,
        habitName: data?.habitName || 'Unknown Habit',
        ...data
      },
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      },
      duration: 500 // Default animation duration
    };

    this.currentSequence.push(step);
    console.log(`[AnimationCapture] Captured habit action:`, step);
  }

  captureGoalAction(goalId: string, action: 'create' | 'update' | 'complete' | 'delete', element: HTMLElement, data?: Record<string, any>) {
    if (!this.isCapturing) return;

    const rect = element.getBoundingClientRect();
    const step: AnimationStep = {
      id: `step_${this.currentSequence.length + 1}`,
      timestamp: Date.now() - this.sequenceStartTime,
      type: 'goal',
      action,
      element: this.getElementSelector(element),
      data: {
        goalId,
        goalName: data?.goalName || 'Unknown Goal',
        ...data
      },
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      },
      duration: 750 // Slightly longer for goal operations
    };

    this.currentSequence.push(step);
    console.log(`[AnimationCapture] Captured goal action:`, step);
  }

  captureCalendarAction(action: 'eventClick' | 'slotSelect' | 'eventChange', element: HTMLElement, data?: Record<string, any>) {
    if (!this.isCapturing) return;

    const rect = element.getBoundingClientRect();
    const step: AnimationStep = {
      id: `step_${this.currentSequence.length + 1}`,
      timestamp: Date.now() - this.sequenceStartTime,
      type: 'calendar',
      action,
      element: this.getElementSelector(element),
      data: {
        ...data
      },
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      },
      duration: 300 // Quick calendar interactions
    };

    this.currentSequence.push(step);
    console.log(`[AnimationCapture] Captured calendar action:`, step);
  }

  private getElementSelector(element: HTMLElement): string {
    // Generate a simple selector for the element
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const id = element.id ? `#${element.id}` : '';
    
    return `${tagName}${id}${className}`;
  }

  private saveSequence(sequence: AnimationSequence) {
    try {
      const existingSequences = this.getStoredSequences();
      existingSequences.push(sequence);
      
      // Keep only the last 10 sequences
      const recentSequences = existingSequences.slice(-10);
      
      localStorage.setItem('dashboard_animation_sequences', JSON.stringify(recentSequences));
    } catch (error) {
      console.error('[AnimationCapture] Failed to save sequence:', error);
    }
  }

  getStoredSequences(): AnimationSequence[] {
    try {
      const stored = localStorage.getItem('dashboard_animation_sequences');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('[AnimationCapture] Failed to load sequences:', error);
      return [];
    }
  }

  clearStoredSequences() {
    localStorage.removeItem('dashboard_animation_sequences');
  }

  isCurrentlyCapturing(): boolean {
    return this.isCapturing;
  }

  getCurrentCaptureId(): string {
    return this.captureId;
  }
}

// Singleton instance
export const animationCapture = new AnimationCaptureManager();

// Helper hook for React components
export function useAnimationCapture() {
  return {
    startCapture: (name: string) => animationCapture.startCapture(name),
    stopCapture: () => animationCapture.stopCapture(),
    captureHabitAction: (habitId: string, action: 'start' | 'complete' | 'pause', element: HTMLElement, data?: Record<string, any>) => 
      animationCapture.captureHabitAction(habitId, action, element, data),
    captureGoalAction: (goalId: string, action: 'create' | 'update' | 'complete' | 'delete', element: HTMLElement, data?: Record<string, any>) => 
      animationCapture.captureGoalAction(goalId, action, element, data),
    captureCalendarAction: (action: 'eventClick' | 'slotSelect' | 'eventChange', element: HTMLElement, data?: Record<string, any>) => 
      animationCapture.captureCalendarAction(action, element, data),
    isCapturing: () => animationCapture.isCurrentlyCapturing(),
    getStoredSequences: () => animationCapture.getStoredSequences(),
    clearSequences: () => animationCapture.clearStoredSequences()
  };
}