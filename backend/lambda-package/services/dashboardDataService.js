/**
 * Dashboard Data Service
 *
 * Platform-independent service for fetching and calculating dashboard data.
 * This service can be used by various integrations (Slack, LINE, Discord, etc.)
 * without modification.
 *
 * Requirements:
 * - 1.1: Create DashboardDataService in backend/src/services/dashboardDataService.ts
 * - 1.2: Use dependency injection for repositories
 * - 1.3: Return data in platform-agnostic JSON format
 * - 1.4: Use JST timezone for all date calculations
 * - 1.5: Reuse existing repository patterns
 *
 * Properties:
 * - Property 1: JST Day Boundary Calculation
 * - Property 2: Daily Progress Filtering
 * - Property 3: Daily Progress Schema Completeness
 * - Property 4: Daily Progress Sorting
 * - Property 5: Achievement Rate Calculation
 * - Property 6: Statistics TOP3 Selection
 * - Property 7: Next Habits Time Window Filtering
 * - Property 8: Next Habits Exclusion Rules
 * - Property 9: Next Habits Sorting and Limit
 * - Property 10: Stickies Schema and Ordering
 */
import { DataFetchError } from '../errors/index.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger('dashboardDataService');
/**
 * Platform-independent service for dashboard data.
 *
 * This service provides methods to fetch and calculate dashboard data
 * for habits, statistics, upcoming habits, and stickies. All methods
 * return platform-agnostic data structures that can be formatted
 * by integration-specific formatters (e.g., SlackBlockBuilder).
 */
export class DashboardDataService {
    habitRepo;
    activityRepo;
    goalRepo;
    stickyRepo;
    /**
     * Initialize the DashboardDataService with injected repositories.
     *
     * @param habitRepo - Repository for habit database operations.
     * @param activityRepo - Repository for activity database operations.
     * @param goalRepo - Repository for goal database operations.
     * @param stickyRepo - Repository for sticky database operations.
     */
    constructor(habitRepo, activityRepo, goalRepo, stickyRepo) {
        this.habitRepo = habitRepo;
        this.activityRepo = activityRepo;
        this.goalRepo = goalRepo;
        this.stickyRepo = stickyRepo;
    }
    /**
     * Get the start and end datetime boundaries for the current JST day.
     *
     * Returns UTC timestamps that correspond to JST 0:00:00 and JST 23:59:59
     * of the current day.
     *
     * **Property 1: JST Day Boundary Calculation**
     *
     * @returns Tuple of [startUtc, endUtc] Date objects
     */
    getJstDayBoundaries() {
        const now = new Date();
        const jstOffset = 9 * 60; // minutes
        const utcOffset = now.getTimezoneOffset();
        const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);
        const startJst = new Date(jstTime);
        startJst.setHours(0, 0, 0, 0);
        const endJst = new Date(jstTime);
        endJst.setHours(23, 59, 59, 999);
        const startUtc = new Date(startJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);
        const endUtc = new Date(endJst.getTime() - (jstOffset + utcOffset) * 60 * 1000);
        return [startUtc, endUtc];
    }
    /**
     * Format the current JST date for display.
     *
     * @returns Formatted date string (e.g., "2026年1月20日（月）")
     */
    formatJstDateDisplay() {
        const now = new Date();
        const jstOffset = 9 * 60;
        const utcOffset = now.getTimezoneOffset();
        const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);
        const year = jstTime.getFullYear();
        const month = jstTime.getMonth() + 1;
        const day = jstTime.getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        const dayOfWeek = dayNames[jstTime.getDay()];
        return `${year}年${month}月${day}日（${dayOfWeek}）`;
    }
    /**
     * Get the current JST date in YYYY-MM-DD format.
     *
     * @returns Date string in YYYY-MM-DD format
     */
    getJstDateString() {
        const now = new Date();
        const jstOffset = 9 * 60;
        const utcOffset = now.getTimezoneOffset();
        const jstTime = new Date(now.getTime() + (jstOffset + utcOffset) * 60 * 1000);
        const year = jstTime.getFullYear();
        const month = String(jstTime.getMonth() + 1).padStart(2, '0');
        const day = String(jstTime.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Get the name of a goal by ID.
     *
     * @param goalId - ID of the goal (may be null/undefined)
     * @returns Goal name or "No Goal" if not found
     */
    async getGoalName(goalId) {
        if (!goalId) {
            return 'No Goal';
        }
        try {
            const goal = await this.goalRepo.getById(goalId);
            return goal?.name ?? 'No Goal';
        }
        catch (error) {
            logger.warning('Failed to get goal name', {
                goal_id: goalId,
                error: error instanceof Error ? error.message : String(error),
            });
            return 'No Goal';
        }
    }
    /**
     * Calculate current streak count for a habit.
     *
     * @param habitId - ID of the habit.
     * @returns Current streak count (0 if no completions).
     */
    async getHabitStreak(habitId) {
        try {
            const activities = await this.activityRepo.getHabitActivities(habitId, 'complete', 365);
            if (activities.length === 0) {
                return 0;
            }
            let streak = 0;
            let expectedDate = this.getToday();
            const seenDates = new Set();
            for (const activity of activities) {
                const timestampStr = activity.timestamp;
                const activityDateStr = timestampStr.slice(0, 10);
                const activityDate = new Date(activityDateStr);
                if (seenDates.has(activityDateStr)) {
                    continue;
                }
                seenDates.add(activityDateStr);
                if (streak === 0 && this.isSameDate(activityDate, expectedDate)) {
                    streak = 1;
                    expectedDate = this.subtractDays(expectedDate, 1);
                }
                else if (streak === 0 &&
                    this.isSameDate(activityDate, this.subtractDays(expectedDate, 1))) {
                    streak = 1;
                    expectedDate = this.subtractDays(activityDate, 1);
                }
                else if (this.isSameDate(activityDate, expectedDate)) {
                    streak += 1;
                    expectedDate = this.subtractDays(expectedDate, 1);
                }
                else {
                    break;
                }
            }
            return streak;
        }
        catch (error) {
            logger.warning('Failed to calculate streak', {
                habit_id: habitId,
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
    getToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }
    subtractDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() - days);
        return result;
    }
    isSameDate(date1, date2) {
        return (date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate());
    }
    /**
     * Check if a habit has reached its cumulative workload end.
     *
     * @param habit - The habit to check.
     * @param activities - All activities for the owner.
     * @returns True if the habit is cumulatively completed.
     */
    isHabitCumulativelyCompleted(habit, activities) {
        const workloadTotalEnd = habit.workload_total_end;
        if (!workloadTotalEnd || workloadTotalEnd <= 0) {
            return false;
        }
        const habitActivities = activities.filter((a) => a.habit_id === habit.id && a.kind === 'complete');
        const totalAmount = habitActivities.reduce((sum, a) => sum + (a.amount ?? 1), 0);
        return totalAmount >= workloadTotalEnd;
    }
    /**
     * Calculate workload from activities for a habit.
     *
     * @param habitId - ID of the habit.
     * @param activities - List of activities.
     * @param workloadPerCount - Default amount when activity has no amount.
     * @returns Total workload sum.
     */
    calculateWorkload(habitId, activities, workloadPerCount) {
        let totalWorkload = 0;
        for (const activity of activities) {
            if (activity.habit_id !== habitId) {
                continue;
            }
            const amount = activity.amount ?? workloadPerCount;
            totalWorkload += amount;
        }
        return totalWorkload;
    }
    /**
     * Get daily progress for all active habits.
     *
     * Requirements:
     * - 2.1: Return daily progress for all active habits with type="do"
     * - 2.2-2.4: Include all required fields
     * - 2.5: Exclude inactive habits and type="avoid"
     * - 2.6: Sort by goal name
     * - 2.7: Only include activities within JST day boundaries
     *
     * **Property 2: Daily Progress Filtering**
     * **Property 3: Daily Progress Schema Completeness**
     * **Property 4: Daily Progress Sorting**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns DailyProgressData object
     */
    async getDailyProgress(ownerId, ownerType = 'user') {
        try {
            // Get active habits with type="do"
            const habits = (await this.habitRepo.getActiveDoHabits(ownerType, ownerId));
            // Get today's activities
            const [startUtc, endUtc] = this.getJstDayBoundaries();
            const activities = await this.activityRepo.getActivitiesInRange(ownerType, ownerId, startUtc, endUtc, 'complete');
            // Get all activities for cumulative completion check
            const allActivities = await this.activityRepo.getActivitiesByOwnerInRange(ownerType, ownerId, new Date(0), new Date());
            // Build progress list
            const progressList = [];
            for (const habit of habits) {
                // Skip cumulatively completed habits
                if (this.isHabitCumulativelyCompleted(habit, allActivities)) {
                    continue;
                }
                const habitId = habit.id;
                const habitName = habit.name;
                const goalName = await this.getGoalName(habit.goal_id);
                const workloadPerCount = habit.workload_per_count ?? 1;
                const currentCount = this.calculateWorkload(habitId, activities, workloadPerCount);
                // Determine total count
                let totalCount = 1;
                if (habit.workload_total && habit.workload_total > 0) {
                    totalCount = habit.workload_total;
                }
                else if (habit.must && habit.must > 0) {
                    totalCount = habit.must;
                }
                else if (habit.target_count && habit.target_count > 0) {
                    totalCount = habit.target_count;
                }
                const progressRate = totalCount > 0 ? (currentCount / totalCount) * 100 : 0;
                const workloadUnit = habit.workload_unit ?? null;
                const streak = await this.getHabitStreak(habitId);
                const completed = progressRate >= 100;
                progressList.push({
                    habitId,
                    habitName,
                    goalName,
                    currentCount,
                    totalCount,
                    progressRate,
                    workloadUnit,
                    workloadPerCount,
                    streak,
                    completed,
                });
            }
            // Sort by goalName
            progressList.sort((a, b) => a.goalName.localeCompare(b.goalName));
            const totalHabits = progressList.length;
            const completedHabits = progressList.filter((p) => p.completed).length;
            const completionRate = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
            return {
                date: this.getJstDateString(),
                dateDisplay: this.formatJstDateDisplay(),
                totalHabits,
                completedHabits,
                completionRate,
                habits: progressList,
            };
        }
        catch (error) {
            if (error instanceof DataFetchError) {
                throw error;
            }
            throw new DataFetchError(`Failed to get daily progress: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get statistics summary.
     *
     * Requirements:
     * - 3.1: Return statistics summary
     * - 3.2: Include total active habits count
     * - 3.3: Include today's achievement rate
     * - 3.4: Include cumulative achievement rate
     * - 3.5: Include TOP3 habits by progress rate
     * - 3.6: Use JST timezone boundaries
     *
     * **Property 5: Achievement Rate Calculation**
     * **Property 6: Statistics TOP3 Selection**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns StatisticsData object
     */
    async getStatistics(ownerId, ownerType = 'user') {
        try {
            // Get daily progress (reuse existing logic)
            const dailyProgress = await this.getDailyProgress(ownerId, ownerType);
            const totalActiveHabits = dailyProgress.totalHabits;
            const todayAchieved = dailyProgress.completedHabits;
            const todayTotal = dailyProgress.totalHabits;
            const todayAchievementRate = dailyProgress.completionRate;
            // For cumulative, we use the same values for now
            // In a full implementation, this would calculate over a longer period
            const cumulativeAchieved = todayAchieved;
            const cumulativeTotal = todayTotal;
            const cumulativeAchievementRate = todayAchievementRate;
            // Get TOP3 habits by progress rate
            const sortedByProgress = [...dailyProgress.habits].sort((a, b) => b.progressRate - a.progressRate);
            const top3Habits = sortedByProgress.slice(0, 3).map((h) => ({
                habitId: h.habitId,
                habitName: h.habitName,
                progressRate: h.progressRate,
            }));
            return {
                totalActiveHabits,
                todayAchievementRate,
                todayAchieved,
                todayTotal,
                cumulativeAchievementRate,
                cumulativeAchieved,
                cumulativeTotal,
                top3Habits,
                dateDisplay: this.formatJstDateDisplay(),
            };
        }
        catch (error) {
            if (error instanceof DataFetchError) {
                throw error;
            }
            throw new DataFetchError(`Failed to get statistics: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get habits starting in the next 24 hours.
     *
     * Requirements:
     * - 4.1: Return habits starting in the next 24 hours
     * - 4.2-4.3: Include all required fields
     * - 4.4: Exclude completed habits and type="avoid"
     * - 4.5: Exclude cumulatively completed habits
     * - 4.6: Sort by start time ascending
     * - 4.7: Limit to 10 items
     *
     * **Property 7: Next Habits Time Window Filtering**
     * **Property 8: Next Habits Exclusion Rules**
     * **Property 9: Next Habits Sorting and Limit**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns NextHabitsData object
     */
    async getNextHabits(ownerId, ownerType = 'user') {
        try {
            // Get all habits for the owner
            const habits = (await this.habitRepo.getByOwner(ownerType, ownerId, true));
            // Get all activities for cumulative completion check
            const allActivities = await this.activityRepo.getActivitiesByOwnerInRange(ownerType, ownerId, new Date(0), new Date());
            const now = new Date();
            const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const candidates = [];
            for (const habit of habits) {
                // Skip completed habits
                if (habit.completed) {
                    continue;
                }
                // Skip avoid-type habits
                if (habit.type === 'avoid') {
                    continue;
                }
                // Skip cumulatively completed habits
                if (this.isHabitCumulativelyCompleted(habit, allActivities)) {
                    continue;
                }
                // Find next start time
                let found = null;
                const timings = habit.timings ?? [];
                // Check explicit timings first
                if (timings.length > 0) {
                    for (const t of timings) {
                        if (t.start) {
                            const baseDate = t.date ?? habit.due_date ?? now.toISOString().slice(0, 10);
                            let dt = new Date(`${baseDate}T${t.start}:00`);
                            if (dt < now) {
                                const todayStr = now.toISOString().slice(0, 10);
                                dt = new Date(`${todayStr}T${t.start}:00`);
                                if (dt < now) {
                                    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
                                }
                            }
                            if (dt >= now && dt <= windowEnd) {
                                found = dt;
                                break;
                            }
                        }
                    }
                }
                // Fallback: use habit.time / due_date
                if (!found && habit.time) {
                    const baseDate = habit.due_date ?? now.toISOString().slice(0, 10);
                    let dt = new Date(`${baseDate}T${habit.time}:00`);
                    if (dt < now) {
                        dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
                    }
                    if (dt >= now && dt <= windowEnd) {
                        found = dt;
                    }
                }
                if (found) {
                    candidates.push({ habit, startTime: found });
                }
            }
            // Sort by start time
            candidates.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            // Limit to 10
            const limited = candidates.slice(0, 10);
            // Build response
            const habitItems = limited.map(({ habit, startTime }) => {
                const todayStr = now.toISOString().slice(0, 10);
                const startDateStr = startTime.toISOString().slice(0, 10);
                const timeStr = startTime.toTimeString().slice(0, 5);
                let startTimeDisplay;
                if (startDateStr === todayStr) {
                    startTimeDisplay = timeStr;
                }
                else {
                    startTimeDisplay = `明日 ${timeStr}`;
                }
                return {
                    habitId: habit.id,
                    habitName: habit.name,
                    startTime: startTime.toISOString(),
                    startTimeDisplay,
                    workloadUnit: habit.workload_unit ?? null,
                    targetAmount: habit.workload_per_count ?? 1,
                };
            });
            return {
                habits: habitItems,
                count: habitItems.length,
            };
        }
        catch (error) {
            if (error instanceof DataFetchError) {
                throw error;
            }
            throw new DataFetchError(`Failed to get next habits: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Get stickies for an owner.
     *
     * Requirements:
     * - 5.1: Return sticky notes
     * - 5.2: Include name and completion status
     * - 5.3: Include description if available
     * - 5.4: Sort by display order
     *
     * **Property 10: Stickies Schema and Ordering**
     *
     * @param ownerId - User ID
     * @param ownerType - Type of owner (default: "user")
     * @returns StickiesData object
     */
    async getStickies(ownerId, ownerType = 'user') {
        try {
            // Get all stickies for the owner
            const stickies = await this.stickyRepo.getByOwner(ownerType, ownerId);
            // Map to StickyItem format
            const stickyItems = stickies.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description ?? null,
                completed: s.completed,
                displayOrder: s.display_order,
            }));
            // Sort by display order (already sorted by repository, but ensure)
            stickyItems.sort((a, b) => a.displayOrder - b.displayOrder);
            // Count incomplete and completed
            const incompleteCount = stickyItems.filter((s) => !s.completed).length;
            const completedCount = stickyItems.filter((s) => s.completed).length;
            return {
                stickies: stickyItems,
                incompleteCount,
                completedCount,
            };
        }
        catch (error) {
            if (error instanceof DataFetchError) {
                throw error;
            }
            throw new DataFetchError(`Failed to get stickies: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
        }
    }
}
//# sourceMappingURL=dashboardDataService.js.map