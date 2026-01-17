/**
 * Position Calculation Utility Functions
 * 
 * This module provides pure functions for calculating and constraining
 * node positions within the mindmap viewport.
 */

/** Viewport configuration */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Position coordinates */
export interface Position {
  x: number;
  y: number;
}

/** Bounds configuration */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Screen dimensions */
export interface ScreenDimensions {
  width: number;
  height: number;
}

/** Default margin from screen edges */
const DEFAULT_MARGIN = 100;

/** Default header height for mobile */
const MOBILE_HEADER_HEIGHT = 60;

/** Default node dimensions for centering */
const NODE_OFFSET = {
  x: 60,
  y: 30,
};

/**
 * Calculates the center position of the viewport.
 * 
 * @param viewport - Current viewport state
 * @param isMobile - Whether the device is mobile
 * @param screenDimensions - Optional screen dimensions (defaults to window)
 * @returns Position at the center of the viewport
 * 
 * @example
 * const position = calculateCenterPosition(
 *   { x: 0, y: 0, zoom: 1 },
 *   false
 * );
 */
export function calculateCenterPosition(
  viewport: Viewport,
  isMobile: boolean,
  screenDimensions?: ScreenDimensions
): Position {
  const screenWidth = screenDimensions?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenHeight = screenDimensions?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 600);

  let position: Position;

  if (isMobile) {
    const effectiveHeight = screenHeight - MOBILE_HEADER_HEIGHT;
    position = {
      x: (-viewport.x + screenWidth / 2) / viewport.zoom - NODE_OFFSET.x,
      y: (-viewport.y + effectiveHeight / 2) / viewport.zoom - NODE_OFFSET.y,
    };
  } else {
    position = {
      x: -viewport.x + screenWidth / 2 / viewport.zoom - NODE_OFFSET.x,
      y: -viewport.y + screenHeight / 2 / viewport.zoom - NODE_OFFSET.y,
    };
  }

  return position;
}

/**
 * Calculates the bounds for valid node positions.
 * 
 * @param viewport - Current viewport state
 * @param margin - Margin from screen edges
 * @param screenDimensions - Optional screen dimensions
 * @returns Bounds object with min/max coordinates
 */
export function calculateViewportBounds(
  viewport: Viewport,
  margin: number = DEFAULT_MARGIN,
  screenDimensions?: ScreenDimensions
): Bounds {
  const screenWidth = screenDimensions?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenHeight = screenDimensions?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 600);

  return {
    minX: (-viewport.x + margin) / viewport.zoom,
    maxX: (-viewport.x + screenWidth - margin) / viewport.zoom,
    minY: (-viewport.y + margin) / viewport.zoom,
    maxY: (-viewport.y + screenHeight - margin) / viewport.zoom,
  };
}

/**
 * Constrains a position to be within the specified bounds.
 * 
 * @param position - Position to constrain
 * @param bounds - Bounds to constrain within
 * @returns Constrained position
 * 
 * @example
 * const constrained = constrainPositionToBounds(
 *   { x: -100, y: 1000 },
 *   { minX: 0, maxX: 800, minY: 0, maxY: 600 }
 * );
 * // Returns: { x: 0, y: 600 }
 */
export function constrainPositionToBounds(
  position: Position,
  bounds: Bounds
): Position {
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, position.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, position.y)),
  };
}

/**
 * Constrains a position to be within the viewport.
 * Combines calculateViewportBounds and constrainPositionToBounds.
 * 
 * @param position - Position to constrain
 * @param viewport - Current viewport state
 * @param margin - Margin from screen edges
 * @param screenDimensions - Optional screen dimensions
 * @returns Constrained position
 */
export function constrainPositionToViewport(
  position: Position,
  viewport: Viewport,
  margin: number = DEFAULT_MARGIN,
  screenDimensions?: ScreenDimensions
): Position {
  const bounds = calculateViewportBounds(viewport, margin, screenDimensions);
  return constrainPositionToBounds(position, bounds);
}

/**
 * Converts client coordinates to flow coordinates.
 * 
 * @param clientX - Client X coordinate
 * @param clientY - Client Y coordinate
 * @param containerBounds - Container element bounds
 * @param project - React Flow project function
 * @returns Position in flow coordinates
 */
export function clientToFlowPosition(
  clientX: number,
  clientY: number,
  containerBounds: DOMRect,
  project: (point: { x: number; y: number }) => { x: number; y: number }
): Position {
  return project({
    x: clientX - containerBounds.left,
    y: clientY - containerBounds.top,
  });
}

/**
 * Calculates a new node position with viewport constraints.
 * This is the main function used when creating new nodes.
 * 
 * @param viewport - Current viewport state
 * @param isMobile - Whether the device is mobile
 * @param screenDimensions - Optional screen dimensions
 * @returns Position for the new node
 */
export function calculateNewNodePosition(
  viewport: Viewport,
  isMobile: boolean,
  screenDimensions?: ScreenDimensions
): Position {
  // Calculate center position
  const centerPosition = calculateCenterPosition(viewport, isMobile, screenDimensions);

  // Calculate extended bounds (allow some overflow)
  const screenWidth = screenDimensions?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 800);
  const screenHeight = screenDimensions?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 600);

  const extendedBounds: Bounds = {
    minX: (-viewport.x - 200) / viewport.zoom,
    maxX: (-viewport.x + screenWidth + 200) / viewport.zoom,
    minY: (-viewport.y - 200) / viewport.zoom,
    maxY: (-viewport.y + screenHeight + 200) / viewport.zoom,
  };

  // Constrain to extended bounds
  return constrainPositionToBounds(centerPosition, extendedBounds);
}

/**
 * Checks if a position is within the visible viewport.
 * 
 * @param position - Position to check
 * @param viewport - Current viewport state
 * @param screenDimensions - Optional screen dimensions
 * @returns True if the position is visible
 */
export function isPositionVisible(
  position: Position,
  viewport: Viewport,
  screenDimensions?: ScreenDimensions
): boolean {
  const bounds = calculateViewportBounds(viewport, 0, screenDimensions);
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX &&
    position.y >= bounds.minY &&
    position.y <= bounds.maxY
  );
}

/**
 * Calculates the distance between two positions.
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Distance between the positions
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the midpoint between two positions.
 * 
 * @param pos1 - First position
 * @param pos2 - Second position
 * @returns Midpoint position
 */
export function calculateMidpoint(pos1: Position, pos2: Position): Position {
  return {
    x: (pos1.x + pos2.x) / 2,
    y: (pos1.y + pos2.y) / 2,
  };
}
