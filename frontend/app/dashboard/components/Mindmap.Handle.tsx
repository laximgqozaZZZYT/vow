/**
 * Mindmap Handle Component
 * 
 * Unified handle component for all mindmap nodes.
 * Provides consistent styling across all mindmap components.
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

/** Handle color variants */
export type HandleColor = 'blue' | 'purple';

/** Props for MindmapHandle component */
interface MindmapHandleProps {
  /** Handle type - target (input) or source (output) */
  type: 'target' | 'source';
  /** Position of the handle */
  position: Position;
  /** Optional handle ID for multiple handles on same side */
  id?: string;
  /** Whether device is mobile */
  isMobile?: boolean;
  /** Color variant */
  color?: HandleColor;
  /** Click handler (for mobile) */
  onClick?: (e: React.MouseEvent) => void;
  /** Touch start handler (for mobile) */
  onTouchStart?: (e: React.TouchEvent) => void;
  /** Touch end handler (for mobile) */
  onTouchEnd?: (e: React.TouchEvent) => void;
}

/** Get position offset based on handle position */
const getPositionStyle = (position: Position, isMobile: boolean): React.CSSProperties => {
  // React Flowのデフォルト位置を上書きするためのオフセット
  // ノードの端からの距離を調整
  const offset = isMobile ? -12 : -8;
  switch (position) {
    case Position.Top:
      return { top: offset };
    case Position.Bottom:
      return { bottom: offset };
    case Position.Left:
      return { left: offset };
    case Position.Right:
      return { right: offset };
    default:
      return {};
  }
};

/** Get dot position style based on handle position */
const getDotPositionStyle = (position: Position, isMobile: boolean, size: number): React.CSSProperties => {
  const offset = isMobile ? -12 : -8;
  const halfSize = size / 2;
  
  switch (position) {
    case Position.Top:
      return { 
        top: offset, 
        left: '50%', 
        marginLeft: -halfSize,
      };
    case Position.Bottom:
      return { 
        bottom: offset, 
        left: '50%', 
        marginLeft: -halfSize,
      };
    case Position.Left:
      return { 
        left: offset, 
        top: '50%', 
        marginTop: -halfSize,
      };
    case Position.Right:
      return { 
        right: offset, 
        top: '50%', 
        marginTop: -halfSize,
      };
    default:
      return {};
  }
};

/** Color configuration for handle variants */
const colorConfig = {
  blue: {
    bg: 'rgba(59, 130, 246, 0.25)',
    border: 'rgba(59, 130, 246, 0.4)',
    dot: 'rgba(59, 130, 246, 0.9)',
  },
  purple: {
    bg: 'rgba(147, 51, 234, 0.25)',
    border: 'rgba(147, 51, 234, 0.4)',
    dot: 'rgba(147, 51, 234, 0.9)',
  },
};

/** Get color styles based on variant */
const getColorStyles = (color: HandleColor) => {
  const { bg, border, dot } = colorConfig[color];
  return { bg, border, dot };
};

/**
 * Unified Mindmap Handle Component
 * 
 * Semi-transparent handle with centered dot indicator.
 */
export const MindmapHandle = memo(function MindmapHandle({
  type,
  position,
  id,
  isMobile = false,
  color = 'blue',
  onClick,
  onTouchStart,
  onTouchEnd,
}: MindmapHandleProps) {
  const colorStyles = getColorStyles(color);
  const size = isMobile ? 24 : 16;
  const dotSize = isMobile ? 8 : 5;

  const handleStyle: React.CSSProperties = {
    width: size,
    height: size,
    backgroundColor: colorStyles.bg,
    border: `2px solid ${colorStyles.border}`,
    borderRadius: '50%',
    zIndex: 10,
    ...getPositionStyle(position, isMobile),
  };

  // 中心の点のスタイル - ハンドルの上に重ねる
  const dotContainerStyle: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 11,
    ...getDotPositionStyle(position, isMobile, size),
  };

  const dotStyle: React.CSSProperties = {
    width: dotSize,
    height: dotSize,
    backgroundColor: colorStyles.dot,
    borderRadius: '50%',
  };

  return (
    <>
      <Handle
        type={type}
        position={position}
        id={id}
        style={handleStyle}
        className="hover:opacity-70 transition-opacity"
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
      <div style={dotContainerStyle}>
        <div style={dotStyle} />
      </div>
    </>
  );
});

/**
 * Renders all four handles for a node
 */
interface NodeHandlesProps {
  isMobile?: boolean;
  color?: HandleColor;
  /** Optional handlers for mobile interaction */
  onHandleClick?: (position: string) => (e: React.MouseEvent) => void;
  onHandleTouchStart?: (position: string) => (e: React.TouchEvent) => void;
  onHandleTouchEnd?: (position: string) => (e: React.TouchEvent) => void;
}

export const NodeHandles = memo(function NodeHandles({
  isMobile = false,
  color = 'blue',
  onHandleClick,
  onHandleTouchStart,
  onHandleTouchEnd,
}: NodeHandlesProps) {
  return (
    <>
      <MindmapHandle
        type="target"
        position={Position.Top}
        isMobile={isMobile}
        color={color}
        onClick={onHandleClick?.('top')}
        onTouchStart={onHandleTouchStart?.('top')}
        onTouchEnd={onHandleTouchEnd?.('top')}
      />
      <MindmapHandle
        type="source"
        position={Position.Bottom}
        isMobile={isMobile}
        color={color}
        onClick={onHandleClick?.('bottom')}
        onTouchStart={onHandleTouchStart?.('bottom')}
        onTouchEnd={onHandleTouchEnd?.('bottom')}
      />
      <MindmapHandle
        type="target"
        position={Position.Left}
        id="left"
        isMobile={isMobile}
        color={color}
        onClick={onHandleClick?.('left')}
        onTouchStart={onHandleTouchStart?.('left')}
        onTouchEnd={onHandleTouchEnd?.('left')}
      />
      <MindmapHandle
        type="source"
        position={Position.Right}
        id="right"
        isMobile={isMobile}
        color={color}
        onClick={onHandleClick?.('right')}
        onTouchStart={onHandleTouchStart?.('right')}
        onTouchEnd={onHandleTouchEnd?.('right')}
      />
    </>
  );
});

/**
 * Goal node handles (purple color)
 */
export const GoalNodeHandles = memo(function GoalNodeHandles(props: Omit<NodeHandlesProps, 'color'>) {
  return <NodeHandles {...props} color="purple" />;
});

/**
 * Habit node handles (blue color)
 */
export const HabitNodeHandles = memo(function HabitNodeHandles(props: Omit<NodeHandlesProps, 'color'>) {
  return <NodeHandles {...props} color="blue" />;
});
