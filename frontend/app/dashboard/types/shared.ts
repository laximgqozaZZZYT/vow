/**
 * Shared Type Definitions
 * 
 * Consolidated type definitions extracted from various components to eliminate 
 * code duplication and provide consistent typing across the application.
 * This file contains common types, interfaces, and utility types used throughout
 * the dashboard components.
 */

// ============================================================================
// Base Entity Types
// ============================================================================

/**
 * Base entity interface with common fields
 * Used as a foundation for database entities
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Base entity with optional timestamps
 * Used for entities that might not have timestamps in all contexts
 */
export interface BaseEntityOptional {
  id: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Device and UI Types
// ============================================================================

/**
 * Device information interface
 * Provides comprehensive device detection data
 */
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  screenWidth: number;
  screenHeight: number;
  isTouchDevice: boolean;
}

/**
 * API state management interface
 * Common pattern for handling async operations
 */
export interface ApiState<T = any> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

/**
 * Extended API state with additional status information
 */
export interface ExtendedApiState<T = any> extends ApiState<T> {
  success: boolean;
  lastUpdated?: string;
}

// ============================================================================
// Date and Time Types
// ============================================================================

/**
 * Date range interface for filtering and selection
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Date range with optional fields
 */
export interface DateRangeOptional {
  start?: Date;
  end?: Date;
}

/**
 * Time string type for HH:MM format
 * Ensures consistent time format across the application
 */
export type TimeString = string; // Format: "HH:MM"

/**
 * Date string type for YYYY-MM-DD format
 * Ensures consistent date format across the application
 */
export type DateString = string; // Format: "YYYY-MM-DD"

/**
 * ISO datetime string type
 * For full datetime representations
 */
export type DateTimeString = string; // Format: ISO 8601

// ============================================================================
// Timing and Schedule Types
// ============================================================================

/**
 * Timing type enumeration
 * Defines different types of scheduling patterns
 */
export type TimingType = 'Date' | 'Daily' | 'Weekly' | 'Monthly';

/**
 * Timing configuration interface
 * Used for scheduling habits and events
 */
export interface Timing {
  id?: string;
  type: TimingType;
  date?: DateString;
  start?: TimeString;
  end?: TimeString;
  cron?: string; // For complex scheduling patterns
}

/**
 * Timing with required ID
 * Used when timing is persisted in database
 */
export interface TimingWithId extends Timing {
  id: string;
}

// ============================================================================
// Habit and Goal Related Types
// ============================================================================

/**
 * Habit type enumeration
 */
export type HabitType = "do" | "avoid";

/**
 * Activity kind enumeration
 */
export type ActivityKind = 'start' | 'complete' | 'skip' | 'pause';

/**
 * Habit action enumeration
 */
export type HabitAction = 'start' | 'complete' | 'pause';

/**
 * Reminder configuration types
 */
export type ReminderAbsolute = {
  kind: 'absolute';
  time: TimeString;
  weekdays: string[];
};

export type ReminderRelative = {
  kind: 'relative';
  minutesBefore: number;
};

export type Reminder = ReminderAbsolute | ReminderRelative;

/**
 * Habit relation types
 */
export type HabitRelationType = 'main' | 'sub' | 'next';

/**
 * Habit relation interface
 */
export interface HabitRelation extends BaseEntityOptional {
  habitId: string;
  relatedHabitId: string;
  relation: HabitRelationType;
}

// ============================================================================
// Event and Calendar Types
// ============================================================================

/**
 * Event changes interface for calendar operations
 */
export interface EventChanges {
  start?: DateTimeString;
  end?: DateTimeString;
  timingIndex?: number;
}

/**
 * Recurring event request interface
 */
export interface RecurringRequest {
  habitId: string;
  start?: DateTimeString;
  end?: DateTimeString;
  timingIndex?: number;
}

/**
 * Calendar event interface
 */
export interface CalendarEvent {
  id: string;
  title: string;
  start: DateTimeString | DateString;
  end?: DateTimeString | DateString;
  allDay: boolean;
  editable: boolean;
  className?: string;
  extendedProps?: Record<string, any>;
}

// ============================================================================
// Form and Input Types
// ============================================================================

/**
 * Form validation state
 */
export interface ValidationState {
  isValid: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

/**
 * Select option interface for dropdowns
 */
export interface SelectOption<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}

/**
 * Time option interface for time pickers
 */
export interface TimeOption {
  label: string;
  value: TimeString;
}

// ============================================================================
// Layout and UI Component Types
// ============================================================================

/**
 * Section identifier type
 */
export type SectionId = 'next' | 'activity' | 'calendar' | 'statics' | 'diary' | 'mindmap';

/**
 * Modal state interface
 */
export interface ModalState {
  isOpen: boolean;
  data?: any;
}

/**
 * Context menu state interface
 */
export interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  data?: any;
}

// ============================================================================
// Workload and Progress Types
// ============================================================================

/**
 * Workload configuration interface
 */
export interface WorkloadConfig {
  unit?: string;
  total?: number;
  totalEnd?: number;
  perCount?: number;
}

/**
 * Progress tracking interface
 */
export interface Progress {
  current: number;
  target: number;
  percentage: number;
  completed: boolean;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Omit multiple properties
 */
export type OmitMultiple<T, K extends keyof T> = Omit<T, K>;

/**
 * Pick multiple properties and make them optional
 */
export type PickOptional<T, K extends keyof T> = Partial<Pick<T, K>>;

// ============================================================================
// Error and Status Types
// ============================================================================

/**
 * Application error interface
 */
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: DateTimeString;
}

/**
 * Operation result interface
 */
export interface OperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: AppError;
}

/**
 * Async operation status
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

// ============================================================================
// Export commonly used type combinations
// ============================================================================

/**
 * Common entity with timing
 */
export interface EntityWithTiming extends BaseEntity {
  timings?: Timing[];
  outdates?: Timing[];
}

/**
 * Common entity with workload
 */
export interface EntityWithWorkload extends BaseEntity {
  workloadUnit?: string;
  workloadTotal?: number;
  workloadTotalEnd?: number;
  workloadPerCount?: number;
}