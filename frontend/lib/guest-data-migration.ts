import { supabase } from './supabaseClient';

export interface GuestDataMigrationResult {
  success: boolean;
  migratedGoals: number;
  migratedHabits: number;
  migratedActivities: number;
  errors: string[];
}

export class GuestDataMigration {
  /**
   * ゲストユーザーのLocalStorageデータをSupabaseに移行
   */
  static async migrateGuestDataToSupabase(userId: string): Promise<GuestDataMigrationResult> {
    const result: GuestDataMigrationResult = {
      success: false,
      migratedGoals: 0,
      migratedHabits: 0,
      migratedActivities: 0,
      errors: []
    };

    if (!supabase) {
      result.errors.push('Supabase not configured');
      return result;
    }

    console.log('[Migration] Starting guest data migration for user:', userId);

    try {
      // 1. Goals移行
      await this.migrateGoals(userId, result);
      
      // 2. Habits移行
      await this.migrateHabits(userId, result);
      
      // 3. Activities移行
      await this.migrateActivities(userId, result);

      // 4. 移行成功時のクリーンアップ
      if (result.errors.length === 0) {
        this.clearGuestData();
        result.success = true;
        console.log('[Migration] Migration completed successfully:', result);
      } else {
        console.warn('[Migration] Migration completed with errors:', result);
      }

    } catch (error) {
      console.error('[Migration] Migration failed:', error);
      result.errors.push(`Migration failed: ${(error as any)?.message || error}`);
    }

    return result;
  }

  /**
   * ゲストGoalsをSupabaseに移行
   */
  private static async migrateGoals(userId: string, result: GuestDataMigrationResult) {
    const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
    
    if (guestGoals.length === 0) {
      console.log('[Migration] No guest goals to migrate');
      return;
    }

    console.log('[Migration] Migrating', guestGoals.length, 'goals');

    for (const goal of guestGoals) {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase!
          .from('goals')
          .insert({
            name: goal.name,
            details: goal.details,
            due_date: goal.dueDate,
            parent_id: goal.parentId,
            owner_type: 'user',
            owner_id: userId,
            is_completed: goal.isCompleted || false,
            created_at: goal.createdAt || now,
            updated_at: now
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Goal migration error:', error);
          result.errors.push(`Goal "${goal.name}": ${error.message}`);
        } else {
          result.migratedGoals++;
          console.log('[Migration] Goal migrated:', goal.name, '→', data.id);
        }
      } catch (error) {
        console.error('[Migration] Goal migration exception:', error);
        result.errors.push(`Goal "${goal.name}": ${(error as any)?.message || error}`);
      }
    }
  }

  /**
   * ゲストHabitsをSupabaseに移行
   */
  private static async migrateHabits(userId: string, result: GuestDataMigrationResult) {
    const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
    
    if (guestHabits.length === 0) {
      console.log('[Migration] No guest habits to migrate');
      return;
    }

    console.log('[Migration] Migrating', guestHabits.length, 'habits');

    // デフォルトゴールを取得または作成
    const defaultGoalId = await this.getOrCreateDefaultGoal(userId);

    for (const habit of guestHabits) {
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase!
          .from('habits')
          .insert({
            goal_id: defaultGoalId, // ゲストHabitsはデフォルトゴールに関連付け
            name: habit.name,
            type: habit.type,
            active: habit.active !== false,
            count: habit.count || 0,
            must: habit.must,
            duration: habit.duration,
            reminders: habit.reminders,
            due_date: habit.dueDate,
            time: habit.time,
            end_time: habit.endTime,
            repeat: habit.repeat,
            timings: habit.timings,
            all_day: habit.allDay,
            notes: habit.notes,
            workload_unit: habit.workloadUnit,
            workload_total: habit.workloadTotal,
            workload_per_count: habit.workloadPerCount || 1,
            completed: habit.completed || false,
            owner_type: 'user',
            owner_id: userId,
            created_at: habit.createdAt || now,
            updated_at: now
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Habit migration error:', error);
          result.errors.push(`Habit "${habit.name}": ${error.message}`);
        } else {
          result.migratedHabits++;
          console.log('[Migration] Habit migrated:', habit.name, '→', data.id);
        }
      } catch (error) {
        console.error('[Migration] Habit migration exception:', error);
        result.errors.push(`Habit "${habit.name}": ${(error as any)?.message || error}`);
      }
    }
  }

  /**
   * ゲストActivitiesをSupabaseに移行
   */
  private static async migrateActivities(userId: string, result: GuestDataMigrationResult) {
    const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
    
    if (guestActivities.length === 0) {
      console.log('[Migration] No guest activities to migrate');
      return;
    }

    console.log('[Migration] Migrating', guestActivities.length, 'activities');

    for (const activity of guestActivities) {
      try {
        const { data, error } = await supabase!
          .from('activities')
          .insert({
            kind: activity.kind,
            habit_id: null, // ゲストActivityのhabitIdは無効なので、nullに設定
            habit_name: activity.habitName,
            timestamp: activity.timestamp,
            amount: activity.amount,
            prev_count: activity.prevCount,
            new_count: activity.newCount,
            duration_seconds: activity.durationSeconds,
            owner_type: 'user',
            owner_id: userId
          })
          .select()
          .single();

        if (error) {
          console.error('[Migration] Activity migration error:', error);
          result.errors.push(`Activity "${activity.habitName}": ${error.message}`);
        } else {
          result.migratedActivities++;
          console.log('[Migration] Activity migrated:', activity.habitName, '→', data.id);
        }
      } catch (error) {
        console.error('[Migration] Activity migration exception:', error);
        result.errors.push(`Activity "${activity.habitName}": ${(error as any)?.message || error}`);
      }
    }
  }

  /**
   * デフォルトゴールを取得または作成
   */
  private static async getOrCreateDefaultGoal(userId: string): Promise<string> {
    // 既存のデフォルトゴールを検索
    const { data: existingGoals, error: searchError } = await supabase!
      .from('goals')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('name', 'My Goals')
      .limit(1);

    if (searchError) {
      console.error('[Migration] Default goal search error:', searchError);
      throw searchError;
    }

    if (existingGoals && existingGoals.length > 0) {
      console.log('[Migration] Using existing default goal:', existingGoals[0].id);
      return existingGoals[0].id;
    }

    // デフォルトゴールを作成
    console.log('[Migration] Creating new default goal');
    const now = new Date().toISOString();
    const { data: newGoal, error: createError } = await supabase!
      .from('goals')
      .insert({
        name: 'My Goals',
        details: 'Default goal for organizing habits (migrated from guest data)',
        owner_type: 'user',
        owner_id: userId,
        is_completed: false,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();

    if (createError) {
      console.error('[Migration] Default goal creation error:', createError);
      throw createError;
    }

    console.log('[Migration] Created new default goal:', newGoal.id);
    return newGoal.id;
  }

  /**
   * ゲストデータをLocalStorageから削除
   */
  private static clearGuestData() {
    console.log('[Migration] Clearing guest data from localStorage');
    localStorage.removeItem('guest-goals');
    localStorage.removeItem('guest-habits');
    localStorage.removeItem('guest-activities');
  }

  /**
   * ゲストデータが存在するかチェック
   */
  static hasGuestData(): boolean {
    const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
    const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
    const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
    
    return guestGoals.length > 0 || guestHabits.length > 0 || guestActivities.length > 0;
  }
}