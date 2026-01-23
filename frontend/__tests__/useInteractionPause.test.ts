/**
 * Unit Tests for useInteractionPause Hook
 *
 * Tests the interaction pause/resume functionality for the demo section.
 *
 * Requirements: 4.7, 4.8
 * - 4.7: Animation SHALL pause when the user hovers over or touches the demo section
 * - 4.8: When the user stops interacting, animation SHALL resume after a 3-second delay
 */

import { renderHook, act } from '@testing-library/react';
import { useInteractionPause } from '../app/demo/hooks/useInteractionPause';

// Mock timers for testing setTimeout behavior
jest.useFakeTimers();

describe('useInteractionPause', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Initial State', () => {
    it('should initialize with isPaused as false', () => {
      const { result } = renderHook(() => useInteractionPause());

      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.isHovering).toBe(false);
      expect(result.current.state.isTouching).toBe(false);
      expect(result.current.state.isResumeTimerActive).toBe(false);
    });

    it('should provide all required handlers', () => {
      const { result } = renderHook(() => useInteractionPause());

      expect(result.current.handlers.onMouseEnter).toBeDefined();
      expect(result.current.handlers.onMouseLeave).toBeDefined();
      expect(result.current.handlers.onTouchStart).toBeDefined();
      expect(result.current.handlers.onTouchEnd).toBeDefined();
      expect(result.current.handlers.onTouchCancel).toBeDefined();
      expect(result.current.handlers.pause).toBeDefined();
      expect(result.current.handlers.resumeImmediately).toBeDefined();
      expect(result.current.handlers.cancelResumeTimer).toBeDefined();
    });
  });

  describe('Requirement 4.7: Pause on Hover/Touch', () => {
    it('should pause immediately when mouse enters', () => {
      const onPause = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ onPause })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isHovering).toBe(true);
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('should pause immediately when touch starts', () => {
      const onPause = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ onPause })
      );

      act(() => {
        result.current.handlers.onTouchStart();
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isTouching).toBe(true);
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('should call onPause only once for multiple interactions', () => {
      const onPause = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ onPause })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onTouchStart();
      });

      // onPause should only be called once (on first interaction)
      expect(onPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 4.8: Resume After 3-Second Delay', () => {
    it('should start resume timer when mouse leaves', () => {
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000 })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      expect(result.current.state.isHovering).toBe(false);
      expect(result.current.state.isResumeTimerActive).toBe(true);
      expect(result.current.state.isPaused).toBe(true); // Still paused during timer
    });

    it('should resume after 3 seconds when interaction ends', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      // Before 3 seconds
      act(() => {
        jest.advanceTimersByTime(2999);
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(onResume).not.toHaveBeenCalled();

      // After 3 seconds
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.isResumeTimerActive).toBe(false);
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('should cancel resume timer if user interacts again', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      // First interaction
      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      // Wait 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.state.isResumeTimerActive).toBe(true);

      // User interacts again before 3 seconds
      act(() => {
        result.current.handlers.onMouseEnter();
      });

      expect(result.current.state.isResumeTimerActive).toBe(false);
      expect(result.current.state.isPaused).toBe(true);

      // Wait another 3 seconds - should not resume because user is hovering
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(onResume).not.toHaveBeenCalled();
    });

    it('should use custom resume delay', () => {
      const onResume = jest.fn();
      const customDelay = 5000;
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: customDelay, onResume })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      // Before custom delay
      act(() => {
        jest.advanceTimersByTime(4999);
      });

      expect(onResume).not.toHaveBeenCalled();

      // After custom delay
      act(() => {
        jest.advanceTimersByTime(1);
      });

      expect(onResume).toHaveBeenCalledTimes(1);
    });
  });

  describe('Touch Events', () => {
    it('should start resume timer when touch ends', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      act(() => {
        result.current.handlers.onTouchStart();
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.state.isTouching).toBe(false);
      expect(result.current.state.isResumeTimerActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('should handle touch cancel the same as touch end', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      act(() => {
        result.current.handlers.onTouchStart();
      });

      act(() => {
        result.current.handlers.onTouchCancel();
      });

      expect(result.current.state.isTouching).toBe(false);
      expect(result.current.state.isResumeTimerActive).toBe(true);

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(onResume).toHaveBeenCalledTimes(1);
    });
  });

  describe('Combined Hover and Touch', () => {
    it('should not start resume timer if still touching when mouse leaves', () => {
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000 })
      );

      // Start both hover and touch
      act(() => {
        result.current.handlers.onMouseEnter();
        result.current.handlers.onTouchStart();
      });

      // Mouse leaves but still touching
      act(() => {
        result.current.handlers.onMouseLeave();
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isResumeTimerActive).toBe(false);
    });

    it('should not start resume timer if still hovering when touch ends', () => {
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000 })
      );

      // Start both hover and touch
      act(() => {
        result.current.handlers.onMouseEnter();
        result.current.handlers.onTouchStart();
      });

      // Touch ends but still hovering
      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(result.current.state.isResumeTimerActive).toBe(false);
    });
  });

  describe('Manual Controls', () => {
    it('should pause manually', () => {
      const onPause = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ onPause })
      );

      act(() => {
        result.current.handlers.pause();
      });

      expect(result.current.state.isPaused).toBe(true);
      expect(onPause).toHaveBeenCalledTimes(1);
    });

    it('should resume immediately when resumeImmediately is called', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.resumeImmediately();
      });

      expect(result.current.state.isPaused).toBe(false);
      expect(result.current.state.isHovering).toBe(false);
      expect(onResume).toHaveBeenCalledTimes(1);
    });

    it('should cancel resume timer without resuming', () => {
      const onResume = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000, onResume })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      expect(result.current.state.isResumeTimerActive).toBe(true);

      act(() => {
        result.current.handlers.cancelResumeTimer();
      });

      expect(result.current.state.isResumeTimerActive).toBe(false);
      // Still paused because we cancelled the timer
      expect(result.current.state.isPaused).toBe(false);
      expect(onResume).not.toHaveBeenCalled();
    });
  });

  describe('Enabled Option', () => {
    it('should not pause when disabled', () => {
      const onPause = jest.fn();
      const { result } = renderHook(() =>
        useInteractionPause({ enabled: false, onPause })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      expect(result.current.state.isPaused).toBe(false);
      expect(onPause).not.toHaveBeenCalled();
    });
  });

  describe('Time Until Resume', () => {
    it('should track time until resume', () => {
      const { result } = renderHook(() =>
        useInteractionPause({ resumeDelay: 3000 })
      );

      act(() => {
        result.current.handlers.onMouseEnter();
      });

      act(() => {
        result.current.handlers.onMouseLeave();
      });

      expect(result.current.state.timeUntilResume).toBe(3000);

      // Advance time and check countdown
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // The countdown interval updates every 100ms
      expect(result.current.state.timeUntilResume).toBeLessThanOrEqual(2000);
    });
  });
});
