/**
 * Date and Time Utility Functions
 * 
 * Consolidated date processing utilities extracted from Modal.Habit.tsx, 
 * Modal.Goal.tsx, Widget.Calendar.tsx, and Section.Next.tsx to eliminate 
 * code duplication and provide consistent date handling across the application.
 */

/**
 * Format a Date object to local YYYY-MM-DD string
 * Avoids toISOString() which uses UTC and can cause date shifts
 * 
 * @param date - Date object to format
 * @returns YYYY-MM-DD formatted string
 */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a YYYY-MM-DD string or Date object into a local Date (midnight local time)
 * Handles various input formats and provides fallback parsing
 * 
 * @param input - String in YYYY-MM-DD format, Date object, or null/undefined
 * @returns Date object or undefined if parsing fails
 */
export function parseYMD(input?: string | Date | null): Date | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return input;
  
  // Try structured parsing first (YYYY-MM-DD format)
  const parts = String(input).split('-').map(x => Number(x));
  if (parts.length >= 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  
  // Fallback to Date constructor
  const date = new Date(String(input));
  return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Get YYYY-MM-DD string from a Date object
 * Alias for formatLocalDate for consistency with existing code patterns
 * 
 * @param date - Date object to format
 * @returns YYYY-MM-DD formatted string
 */
export function ymd(date: Date): string {
  return formatLocalDate(date);
}

/**
 * Add specified number of days to a date
 * Returns a new Date object without modifying the original
 * 
 * @param date - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New Date object with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get time string in HH:MM format from a Date object
 * Uses 24-hour format with zero-padding
 * 
 * @param date - Date object to extract time from
 * @returns HH:MM formatted time string
 */
export function getTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Build a list of time options in 15-minute increments
 * Used for time picker dropdowns across the application
 * 
 * @returns Array of time options with label and value properties
 */
export function buildTimeOptions(): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];
  
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      const label = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      const value = date.toTimeString().slice(0, 5);
      options.push({ label, value });
    }
  }
  
  return options;
}

/**
 * Convert HH:MM time string to minutes since midnight
 * Used for duration calculations and time comparisons
 * 
 * @param timeString - Time string in HH:MM format
 * @returns Minutes since midnight, or null if parsing fails
 */
export function minutesFromHHMM(timeString?: string): number | null {
  if (!timeString) return null;
  
  const match = String(timeString).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  
  return hours * 60 + minutes;
}