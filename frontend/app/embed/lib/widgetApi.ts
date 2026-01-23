/**
 * Widget API Client
 *
 * Client-side API client for embeddable dashboard widgets.
 * Handles API key authentication and error responses for widget endpoints.
 *
 * Endpoints:
 * - GET /api/widgets/progress - Daily progress data
 * - GET /api/widgets/stats - Statistics data
 * - GET /api/widgets/next - Next habits data
 * - GET /api/widgets/stickies - Stickies data
 * - POST /api/widgets/habits/:habitId/complete - Complete a habit
 * - POST /api/widgets/stickies/:stickyId/toggle - Toggle sticky completion
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Daily progress item for a single habit.
 */
export interface DailyProgressItem {
  habitId: string;
  habitName: string;
  goalName: string;
  currentCount: number;
  totalCount: number;
  progressRate: number;
  workloadUnit: string | null;
  workloadPerCount: number;
  streak: number;
  completed: boolean;
}

/**
 * Daily progress data response.
 * Requirements: 4.1 - Return daily progress data in JSON format
 */
export interface DailyProgressData {
  date: string;
  dateDisplay: string;
  totalHabits: number;
  completedHabits: number;
  completionRate: number;
  habits: DailyProgressItem[];
}

/**
 * TOP3 habit item for statistics.
 */
export interface Top3Habit {
  habitId: string;
  habitName: string;
  progressRate: number;
}

/**
 * Statistics data response.
 * Requirements: 4.2 - Return statistics data in JSON format
 */
export interface StatisticsData {
  totalActiveHabits: number;
  todayAchievementRate: number;
  todayAchieved: number;
  todayTotal: number;
  cumulativeAchievementRate: number;
  cumulativeAchieved: number;
  cumulativeTotal: number;
  top3Habits: Top3Habit[];
  dateDisplay: string;
}

/**
 * Next habit item.
 */
export interface NextHabitItem {
  habitId: string;
  habitName: string;
  startTime: string;
  startTimeDisplay: string;
  workloadUnit: string | null;
  targetAmount: number;
}

/**
 * Next habits data response.
 * Requirements: 4.3 - Return next habits data in JSON format
 */
export interface NextHabitsData {
  habits: NextHabitItem[];
  count: number;
}

/**
 * Sticky item.
 */
export interface StickyItem {
  id: string;
  name: string;
  description: string | null;
  completed: boolean;
  displayOrder: number;
}

/**
 * Stickies data response.
 * Requirements: 4.4 - Return stickies data in JSON format
 */
export interface StickiesData {
  stickies: StickyItem[];
  incompleteCount: number;
  completedCount: number;
}

/**
 * Sticky toggle response.
 */
export interface StickyToggleResponse {
  id: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
}

/**
 * API error response format.
 */
export interface WidgetApiError {
  error: string;
  message: string;
  retryAfter?: number;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for Widget API errors.
 */
export class WidgetApiClientError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'WidgetApiClientError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryAfter = retryAfter;
  }

  /**
   * Check if the error is an authentication error.
   */
  isAuthError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if the error is a rate limit error.
   */
  isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if the error is a forbidden error.
   */
  isForbiddenError(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if the error is a not found error.
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }
}

// ============================================================================
// Widget API Client
// ============================================================================

/**
 * Configuration options for the Widget API client.
 */
export interface WidgetApiClientConfig {
  /** API key for authentication */
  apiKey: string;
  /** Base URL for the API (defaults to current origin) */
  baseUrl?: string;
}

/**
 * Widget API Client for embeddable dashboard widgets.
 *
 * This client handles API key authentication via X-API-Key header
 * and provides typed methods for all widget endpoints.
 */
export class WidgetApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  /**
   * Create a new Widget API client.
   *
   * @param config - Client configuration
   */
  constructor(config: WidgetApiClientConfig) {
    this.apiKey = config.apiKey;
    // Default to current origin for browser context
    this.baseUrl = config.baseUrl ?? (typeof window !== 'undefined' ? window.location.origin : '');
  }

  /**
   * Make an authenticated request to the Widget API.
   *
   * @param endpoint - API endpoint path (e.g., '/api/widgets/progress')
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws WidgetApiClientError on API errors
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Parse response body
      const text = await response.text();
      let data: T | WidgetApiError;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // If JSON parsing fails, treat as text error
        throw new WidgetApiClientError(
          text || 'Unknown error',
          response.status,
          'PARSE_ERROR'
        );
      }

      // Handle error responses
      if (!response.ok) {
        const errorData = data as WidgetApiError;
        const retryAfter = response.headers.get('Retry-After');

        throw new WidgetApiClientError(
          errorData.message || 'Request failed',
          response.status,
          errorData.error || 'UNKNOWN_ERROR',
          retryAfter ? parseInt(retryAfter, 10) : errorData.retryAfter
        );
      }

      return data as T;
    } catch (error) {
      // Re-throw WidgetApiClientError as-is
      if (error instanceof WidgetApiClientError) {
        throw error;
      }

      // Wrap network errors
      throw new WidgetApiClientError(
        error instanceof Error ? error.message : 'Network error',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // ==========================================================================
  // Widget Data Endpoints
  // ==========================================================================

  /**
   * Fetch daily progress data.
   *
   * Requirements: 4.1 - Return daily progress data in JSON format
   *
   * @returns Daily progress data
   * @throws WidgetApiClientError on API errors
   */
  async getProgress(): Promise<DailyProgressData> {
    return this.request<DailyProgressData>('/api/widgets/progress');
  }

  /**
   * Fetch statistics data.
   *
   * Requirements: 4.2 - Return statistics data in JSON format
   *
   * @returns Statistics data
   * @throws WidgetApiClientError on API errors
   */
  async getStats(): Promise<StatisticsData> {
    return this.request<StatisticsData>('/api/widgets/stats');
  }

  /**
   * Fetch next habits data.
   *
   * Requirements: 4.3 - Return next habits data in JSON format
   *
   * @returns Next habits data
   * @throws WidgetApiClientError on API errors
   */
  async getNextHabits(): Promise<NextHabitsData> {
    return this.request<NextHabitsData>('/api/widgets/next');
  }

  /**
   * Fetch stickies data.
   *
   * Requirements: 4.4 - Return stickies data in JSON format
   *
   * @returns Stickies data
   * @throws WidgetApiClientError on API errors
   */
  async getStickies(): Promise<StickiesData> {
    return this.request<StickiesData>('/api/widgets/stickies');
  }

  // ==========================================================================
  // Interactive Operation Endpoints
  // ==========================================================================

  /**
   * Complete a habit with the specified amount.
   *
   * Requirements: 5.1 - Record completion activity for a habit
   *
   * @param habitId - ID of the habit to complete
   * @param amount - Amount to complete (defaults to 1)
   * @returns Updated daily progress data
   * @throws WidgetApiClientError on API errors
   */
  async completeHabit(habitId: string, amount: number = 1): Promise<DailyProgressData> {
    return this.request<DailyProgressData>(
      `/api/widgets/habits/${encodeURIComponent(habitId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }
    );
  }

  /**
   * Toggle a sticky's completion status.
   *
   * Requirements: 5.2 - Toggle sticky completion status
   *
   * @param stickyId - ID of the sticky to toggle
   * @returns Updated sticky data
   * @throws WidgetApiClientError on API errors
   */
  async toggleSticky(stickyId: string): Promise<StickyToggleResponse> {
    return this.request<StickyToggleResponse>(
      `/api/widgets/stickies/${encodeURIComponent(stickyId)}/toggle`,
      {
        method: 'POST',
      }
    );
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Widget API client instance.
 *
 * @param apiKey - API key for authentication
 * @param baseUrl - Optional base URL (defaults to current origin)
 * @returns Widget API client instance
 */
export function createWidgetApiClient(
  apiKey: string,
  baseUrl?: string
): WidgetApiClient {
  return new WidgetApiClient({ apiKey, baseUrl });
}

// ============================================================================
// React Hook Support
// ============================================================================

/**
 * Create a Widget API client from query parameters.
 *
 * This is useful for embed pages that receive the API key via URL.
 *
 * @param searchParams - URL search parameters
 * @returns Widget API client or null if no API key provided
 */
export function createWidgetApiClientFromParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): WidgetApiClient | null {
  const apiKey = searchParams.get('apiKey');

  if (!apiKey) {
    return null;
  }

  return new WidgetApiClient({ apiKey });
}

// Default export for convenience
export default WidgetApiClient;
