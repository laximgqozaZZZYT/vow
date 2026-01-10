import { supabase } from './supabaseClient';

// Supabase direct client - 本番環境では完全に無効化
export class SupabaseDirectClient {
  private checkEnvironment() {
    // 本番環境でも動作するように変更（ゲストユーザー対応）
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
  }

  // Timing data validation helpers
  private validateDateFormat(dateStr: string): string {
    // Ensure consistent YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      // Try to parse and reformat
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD format.`);
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    return dateStr;
  }

  private validateTimeFormat(timeStr: string): string {
    // Ensure HH:MM format
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(timeStr)) {
      throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM format.`);
    }
    return timeStr;
  }

  private validateTimeOrder(startTime?: string, endTime?: string): void {
    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes >= endMinutes) {
        throw new Error(`Start time (${startTime}) must be before end time (${endTime}).`);
      }
    }
  }

  private validateTimingEntry(timing: any): void {
    if (timing.date) {
      timing.date = this.validateDateFormat(timing.date);
    }
    if (timing.start) {
      timing.start = this.validateTimeFormat(timing.start);
    }
    if (timing.end) {
      timing.end = this.validateTimeFormat(timing.end);
    }
    
    this.validateTimeOrder(timing.start, timing.end);
  }

  private preserveTimingStructure(originalTiming: any, updates: any): any {
    // Preserve all original fields and merge with updates
    const preserved = { ...originalTiming };
    
    // Only update fields that are explicitly provided
    if (updates.date !== undefined) preserved.date = updates.date;
    if (updates.start !== undefined) preserved.start = updates.start;
    if (updates.end !== undefined) preserved.end = updates.end;
    if (updates.type !== undefined) preserved.type = updates.type;
    if (updates.cron !== undefined) preserved.cron = updates.cron;
    
    // Preserve ID and other metadata if they exist
    if (originalTiming.id) preserved.id = originalTiming.id;
    
    return preserved;
  }

  // ゲストデータをクリアする機能
  clearGuestData() {
    const guestKeys = [
      'guest-goals',
      'guest-habits', 
      'guest-activities',
      'guest-diary-cards',
      'guest-diary-tags',
      'guest-preferences'
    ];
    
    guestKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log('[clearGuestData] Cleared all guest data from localStorage');
  }

  async getGoals() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[getGoals] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
      console.log('[getGoals] Guest mode - loaded from localStorage:', guestGoals.length, 'goals');
      return guestGoals;
    }
    
    console.log('[getGoals] Authenticated mode - querying Supabase for user:', session.session.user.id);
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[getGoals] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getGoals] Successfully loaded', data?.length || 0, 'goals from Supabase');
    console.log('[getGoals] Raw goals data:', data);
    
    // Convert snake_case to camelCase for frontend compatibility
    const goals = (data || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      details: g.details,
      dueDate: g.due_date,
      parentId: g.parent_id, // 重要: snake_caseからcamelCaseに変換
      isCompleted: g.is_completed,
      createdAt: g.created_at,
      updatedAt: g.updated_at
    }));
    
    console.log('[getGoals] Converted goals data:', goals);
    return goals;
  }

  async createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    // ゲストユーザーの場合はローカルストレージに保存
    if (!session?.session?.user) {
      const guestId = 'guest-' + Math.random().toString(36).substr(2, 9);
      const now = new Date().toISOString();
      const goal = {
        id: 'goal-' + Date.now(),
        name: payload.name,
        details: payload.details,
        dueDate: payload.dueDate,
        parentId: payload.parentId,
        isCompleted: false,
        createdAt: now,
        updatedAt: now
      };
      
      // ローカルストレージに保存
      const existingGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
      existingGoals.push(goal);
      localStorage.setItem('guest-goals', JSON.stringify(existingGoals));
      
      return goal;
    }
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        name: payload.name,
        details: payload.details,
        due_date: payload.dueDate,
        parent_id: payload.parentId,
        owner_type: 'user',
        owner_id: session.session.user.id,
        is_completed: false,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Convert snake_case to camelCase for frontend compatibility
    return {
      id: data.id,
      name: data.name,
      details: data.details,
      dueDate: data.due_date,
      parentId: data.parent_id,
      isCompleted: data.is_completed,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateGoal(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
      const goalIndex = guestGoals.findIndex((g: any) => g.id === id);
      
      if (goalIndex === -1) {
        throw new Error(`Goal with id ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedGoal = {
        ...guestGoals[goalIndex],
        updatedAt: now
      };
      
      // Update fields if provided
      if (payload.name !== undefined) updatedGoal.name = payload.name;
      if (payload.details !== undefined) updatedGoal.details = payload.details;
      if (payload.dueDate !== undefined) updatedGoal.dueDate = payload.dueDate;
      if (payload.parentId !== undefined) updatedGoal.parentId = payload.parentId;
      if (payload.isCompleted !== undefined) updatedGoal.isCompleted = payload.isCompleted;
      
      // Update the goal in the array
      guestGoals[goalIndex] = updatedGoal;
      localStorage.setItem('guest-goals', JSON.stringify(guestGoals));
      
      console.log('[updateGoal] Guest goal updated:', updatedGoal);
      return updatedGoal;
    }
    
    // ログインユーザーの場合はSupabaseを更新
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.details !== undefined) updateData.details = payload.details;
    if (payload.dueDate !== undefined) updateData.due_date = payload.dueDate;
    if (payload.parentId !== undefined) updateData.parent_id = payload.parentId;
    if (payload.isCompleted !== undefined) updateData.is_completed = payload.isCompleted;
    
    const { data, error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      details: data.details,
      dueDate: data.due_date,
      parentId: data.parent_id,
      isCompleted: data.is_completed,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async deleteGoal(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
      const goalIndex = guestGoals.findIndex((g: any) => g.id === id);
      
      if (goalIndex === -1) {
        throw new Error(`Goal with id ${id} not found`);
      }
      
      // Remove the goal from the array
      guestGoals.splice(goalIndex, 1);
      localStorage.setItem('guest-goals', JSON.stringify(guestGoals));
      
      console.log('[deleteGoal] Guest goal deleted:', id);
      return { success: true };
    }
    
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async getHabits() {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[getHabits] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
      console.log('[getHabits] Guest mode - loaded from localStorage:', guestHabits.length, 'habits');
      return guestHabits;
    }
    
    console.log('[getHabits] Authenticated mode - querying Supabase for user:', session.session.user.id);
    
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[getHabits] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getHabits] Successfully loaded', data?.length || 0, 'habits from Supabase');
    
    // Convert snake_case to camelCase
    const habits = (data || []).map((h: any) => ({
      id: h.id,
      goalId: h.goal_id,
      name: h.name,
      active: h.active,
      type: h.type,
      count: h.count,
      must: h.must,
      duration: h.duration,
      reminders: h.reminders,
      dueDate: h.due_date,
      time: h.time,
      endTime: h.end_time,
      repeat: h.repeat,
      timings: h.timings,
      outdates: h.outdates,
      allDay: h.all_day,
      notes: h.notes,
      workloadUnit: h.workload_unit,
      workloadTotal: h.workload_total,
      workloadPerCount: h.workload_per_count,
      completed: h.completed,
      lastCompletedAt: h.last_completed_at,
      createdAt: h.created_at,
      updatedAt: h.updated_at
    }));
    
    console.log('[getHabits] Converted habits data:', habits);
    return habits;
  }

  async createHabit(payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    console.log('[createHabit] Starting habit creation:', payload);
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[createHabit] Session check:', session?.session?.user ? 'Authenticated' : 'Not authenticated');
    
    // ゲストユーザーの場合はローカルストレージに保存
    if (!session?.session?.user) {
      console.log('[createHabit] Guest user - saving to localStorage');
      const now = new Date().toISOString();
      const habit = {
        id: 'habit-' + Date.now(),
        goalId: payload.goalId || 'default-goal',
        name: payload.name,
        active: true,
        type: payload.type,
        count: 0,
        must: payload.must,
        duration: payload.duration,
        reminders: payload.reminders,
        dueDate: payload.dueDate,
        time: payload.time,
        endTime: payload.endTime,
        repeat: payload.repeat,
        timings: payload.timings,
        allDay: payload.allDay,
        notes: payload.notes,
        workloadUnit: payload.workloadUnit,
        workloadTotal: payload.workloadTotal,
        workloadPerCount: payload.workloadPerCount || 1,
        completed: false,
        createdAt: now,
        updatedAt: now
      };
      
      const existingHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
      existingHabits.push(habit);
      localStorage.setItem('guest-habits', JSON.stringify(existingHabits));
      
      console.log('[createHabit] Guest habit saved:', habit);
      return habit;
    }
    
    // goalIdが指定されていない場合、デフォルトゴールを作成または取得
    let goalId = payload.goalId;
    if (!goalId) {
      console.log('[createHabit] No goalId provided, creating/finding default goal');
      goalId = await this.getOrCreateDefaultGoal(session.session.user.id);
    }
    
    const now = new Date().toISOString();
    const insertData = {
      goal_id: goalId,
      name: payload.name,
      type: payload.type,
      active: true,
      count: 0,
      must: payload.must,
      duration: payload.duration,
      reminders: payload.reminders,
      due_date: payload.dueDate,
      time: payload.time,
      end_time: payload.endTime,
      repeat: payload.repeat,
      timings: payload.timings,
      all_day: payload.allDay,
      notes: payload.notes,
      workload_unit: payload.workloadUnit,
      workload_total: payload.workloadTotal,
      workload_per_count: payload.workloadPerCount || 1,
      completed: false,
      owner_type: 'user',
      owner_id: session.session.user.id,
      created_at: now,
      updated_at: now
    };
    
    console.log('[createHabit] Insert data:', insertData);
    
    const { data, error } = await supabase
      .from('habits')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('[createHabit] Supabase error:', error);
      throw error;
    }
    
    console.log('[createHabit] Success:', data);
    
    return {
      id: data.id,
      goalId: data.goal_id,
      name: data.name,
      active: data.active,
      type: data.type,
      count: data.count,
      must: data.must,
      duration: data.duration,
      reminders: data.reminders,
      dueDate: data.due_date,
      time: data.time,
      endTime: data.end_time,
      repeat: data.repeat,
      timings: data.timings,
      allDay: data.all_day,
      notes: data.notes,
      workloadUnit: data.workload_unit,
      workloadTotal: data.workload_total,
      workloadPerCount: data.workload_per_count,
      completed: data.completed,
      lastCompletedAt: data.last_completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateHabit(id: string, payload: any) {
    this.checkEnvironment();
    
    console.log('[updateHabit] Starting update for habit:', id);
    console.log('[updateHabit] Payload:', payload);
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
      const habitIndex = guestHabits.findIndex((h: any) => h.id === id);
      
      if (habitIndex === -1) {
        throw new Error(`Habit with id ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedHabit = {
        ...guestHabits[habitIndex],
        updatedAt: now
      };
      
      // Handle timingIndex for selective timing entry updates
      if (typeof payload.timingIndex === 'number') {
        console.log('[updateHabit] Guest: Processing timingIndex update:', payload.timingIndex);
        
        const currentTimings = Array.isArray(updatedHabit.timings) ? updatedHabit.timings : [];
        
        // Validate timingIndex bounds
        if (payload.timingIndex < 0 || payload.timingIndex >= currentTimings.length) {
          throw new Error(`Invalid timingIndex: ${payload.timingIndex}. Must be between 0 and ${currentTimings.length - 1}`);
        }
        
        // Update only the specific timing entry
        const updatedTimings = [...currentTimings];
        const currentTiming = updatedTimings[payload.timingIndex];
        
        // Preserve timing structure and merge updates
        const timingUpdates = {
          date: payload.dueDate,
          start: payload.time,
          end: payload.endTime
        };
        
        const preservedTiming = this.preserveTimingStructure(currentTiming, timingUpdates);
        
        // Validate the updated timing entry
        try {
          this.validateTimingEntry(preservedTiming);
        } catch (error) {
          throw new Error(`Timing validation failed for entry ${payload.timingIndex}: ${(error as Error).message}`);
        }
        
        updatedTimings[payload.timingIndex] = preservedTiming;
        updatedHabit.timings = updatedTimings;
        
        console.log('[updateHabit] Guest: Updated specific timing entry:', preservedTiming);
      } else {
        // Standard field updates (backward compatibility)
        if (payload.dueDate !== undefined) {
          try {
            updatedHabit.dueDate = this.validateDateFormat(payload.dueDate);
          } catch (error) {
            throw new Error(`Date validation failed: ${(error as Error).message}`);
          }
        }
        if (payload.time !== undefined) {
          try {
            updatedHabit.time = this.validateTimeFormat(payload.time);
          } catch (error) {
            throw new Error(`Time validation failed: ${(error as Error).message}`);
          }
        }
        if (payload.endTime !== undefined) {
          try {
            updatedHabit.endTime = this.validateTimeFormat(payload.endTime);
          } catch (error) {
            throw new Error(`End time validation failed: ${(error as Error).message}`);
          }
        }
        
        // Validate time order
        try {
          this.validateTimeOrder(updatedHabit.time, updatedHabit.endTime);
        } catch (error) {
          throw new Error(`Time order validation failed: ${(error as Error).message}`);
        }
        
        if (payload.timings !== undefined) updatedHabit.timings = payload.timings;
        if (payload.outdates !== undefined) updatedHabit.outdates = payload.outdates;
      }
      
      // Update other fields if provided (map camelCase to match guest format)
      if (payload.name !== undefined) updatedHabit.name = payload.name;
      if (payload.goalId !== undefined) updatedHabit.goalId = payload.goalId; // goalIdの更新を追加
      if (payload.active !== undefined) updatedHabit.active = payload.active;
      if (payload.count !== undefined) updatedHabit.count = payload.count;
      if (payload.completed !== undefined) updatedHabit.completed = payload.completed;
      if (payload.lastCompletedAt !== undefined) updatedHabit.lastCompletedAt = payload.lastCompletedAt;
      if (payload.type !== undefined) updatedHabit.type = payload.type;
      if (payload.must !== undefined) updatedHabit.must = payload.must;
      if (payload.duration !== undefined) updatedHabit.duration = payload.duration;
      if (payload.reminders !== undefined) updatedHabit.reminders = payload.reminders;
      if (payload.repeat !== undefined) updatedHabit.repeat = payload.repeat;
      if (payload.allDay !== undefined) updatedHabit.allDay = payload.allDay;
      if (payload.notes !== undefined) updatedHabit.notes = payload.notes;
      if (payload.workloadUnit !== undefined) updatedHabit.workloadUnit = payload.workloadUnit;
      if (payload.workloadTotal !== undefined) updatedHabit.workloadTotal = payload.workloadTotal;
      if (payload.workloadPerCount !== undefined) updatedHabit.workloadPerCount = payload.workloadPerCount;
      
      // Update the habit in the array
      guestHabits[habitIndex] = updatedHabit;
      localStorage.setItem('guest-habits', JSON.stringify(guestHabits));
      
      console.log('[updateHabit] Guest habit updated:', updatedHabit);
      return updatedHabit;
    }
    
    // ログインユーザーの場合はSupabaseを更新
    // First, get the current habit data to handle timingIndex updates
    const { data: currentHabit, error: fetchError } = await supabase
      .from('habits')
      .select('*')
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .single();
    
    if (fetchError) {
      console.error('[updateHabit] Failed to fetch current habit:', fetchError);
      throw fetchError;
    }
    
    if (!currentHabit) {
      throw new Error(`Habit with id ${id} not found`);
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Handle timingIndex for selective timing entry updates
    if (typeof payload.timingIndex === 'number') {
      console.log('[updateHabit] Supabase: Processing timingIndex update:', payload.timingIndex);
      
      const currentTimings = Array.isArray(currentHabit.timings) ? currentHabit.timings : [];
      
      // Validate timingIndex bounds
      if (payload.timingIndex < 0 || payload.timingIndex >= currentTimings.length) {
        throw new Error(`Invalid timingIndex: ${payload.timingIndex}. Must be between 0 and ${currentTimings.length - 1}`);
      }
      
      // Update only the specific timing entry
      const updatedTimings = [...currentTimings];
      const currentTiming = updatedTimings[payload.timingIndex];
      
      // Preserve timing structure and merge updates
      const timingUpdates = {
        date: payload.dueDate,
        start: payload.time,
        end: payload.endTime
      };
      
      const preservedTiming = this.preserveTimingStructure(currentTiming, timingUpdates);
      
      // Validate the updated timing entry
      try {
        this.validateTimingEntry(preservedTiming);
      } catch (error) {
        throw new Error(`Timing validation failed for entry ${payload.timingIndex}: ${(error as Error).message}`);
      }
      
      updatedTimings[payload.timingIndex] = preservedTiming;
      updateData.timings = updatedTimings;
      
      console.log('[updateHabit] Supabase: Updated specific timing entry:', preservedTiming);
      console.log('[updateHabit] Supabase: Full updated timings array:', updatedTimings);
    } else {
      // Standard field updates (backward compatibility)
      if (payload.dueDate !== undefined) {
        try {
          updateData.due_date = this.validateDateFormat(payload.dueDate);
        } catch (error) {
          throw new Error(`Date validation failed: ${(error as Error).message}`);
        }
      }
      if (payload.time !== undefined) {
        try {
          updateData.time = this.validateTimeFormat(payload.time);
        } catch (error) {
          throw new Error(`Time validation failed: ${(error as Error).message}`);
        }
      }
      if (payload.endTime !== undefined) {
        try {
          updateData.end_time = this.validateTimeFormat(payload.endTime);
        } catch (error) {
          throw new Error(`End time validation failed: ${(error as Error).message}`);
        }
      }
      
      // Validate time order
      try {
        this.validateTimeOrder(updateData.time, updateData.end_time);
      } catch (error) {
        throw new Error(`Time order validation failed: ${(error as Error).message}`);
      }
      
      if (payload.timings !== undefined) updateData.timings = payload.timings;
      if (payload.outdates !== undefined) updateData.outdates = payload.outdates;
    }
    
    // Map camelCase to snake_case - 全フィールドを対応
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.goalId !== undefined) updateData.goal_id = payload.goalId; // goalIdの更新を追加
    if (payload.active !== undefined) updateData.active = payload.active;
    if (payload.count !== undefined) updateData.count = payload.count;
    if (payload.completed !== undefined) updateData.completed = payload.completed;
    if (payload.lastCompletedAt !== undefined) updateData.last_completed_at = payload.lastCompletedAt;
    if (payload.type !== undefined) updateData.type = payload.type;
    if (payload.must !== undefined) updateData.must = payload.must;
    if (payload.duration !== undefined) updateData.duration = payload.duration;
    if (payload.reminders !== undefined) updateData.reminders = payload.reminders;
    if (payload.repeat !== undefined) updateData.repeat = payload.repeat;
    if (payload.allDay !== undefined) updateData.all_day = payload.allDay;
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.workloadUnit !== undefined) updateData.workload_unit = payload.workloadUnit;
    if (payload.workloadTotal !== undefined) updateData.workload_total = payload.workloadTotal;
    if (payload.workloadPerCount !== undefined) updateData.workload_per_count = payload.workloadPerCount;
    
    console.log('[updateHabit] Supabase update data:', updateData);
    
    const { data, error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateHabit] Supabase error:', error);
      throw error;
    }
    
    console.log('[updateHabit] Supabase response:', data);
    
    const result = {
      id: data.id,
      goalId: data.goal_id,
      name: data.name,
      active: data.active,
      type: data.type,
      count: data.count,
      must: data.must,
      duration: data.duration,
      reminders: data.reminders,
      dueDate: data.due_date,
      time: data.time,
      endTime: data.end_time,
      repeat: data.repeat,
      timings: data.timings,
      outdates: data.outdates,
      allDay: data.all_day,
      notes: data.notes,
      workloadUnit: data.workload_unit,
      workloadTotal: data.workload_total,
      workloadPerCount: data.workload_per_count,
      completed: data.completed,
      lastCompletedAt: data.last_completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    
    console.log('[updateHabit] Final result:', result);
    return result;
  }

  async deleteHabit(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
      const habitIndex = guestHabits.findIndex((h: any) => h.id === id);
      
      if (habitIndex === -1) {
        throw new Error(`Habit with id ${id} not found`);
      }
      
      // Remove the habit from the array
      guestHabits.splice(habitIndex, 1);
      localStorage.setItem('guest-habits', JSON.stringify(guestHabits));
      
      console.log('[deleteHabit] Guest habit deleted:', id);
      return { success: true };
    }
    
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async getActivities() {
    console.log('[getActivities] Starting to load activities');
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[getActivities] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      console.log('[getActivities] Guest mode - loaded from localStorage:', guestActivities.length, 'activities');
      console.log('[getActivities] Guest activities:', guestActivities);
      return guestActivities;
    }
    
    console.log('[getActivities] Authenticated mode - querying Supabase for user:', session.session.user.id);
    
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('[getActivities] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getActivities] Successfully loaded', data?.length || 0, 'activities from Supabase');
    console.log('[getActivities] Supabase activities:', data);
    
    const activities = (data || []).map((a: any) => ({
      id: a.id,
      kind: a.kind,
      habitId: a.habit_id,
      habitName: a.habit_name,
      timestamp: a.timestamp,
      amount: a.amount,
      prevCount: a.prev_count,
      newCount: a.new_count,
      durationSeconds: a.duration_seconds,
      memo: a.memo
    }));
    
    console.log('[getActivities] Converted activities:', activities);
    return activities;
  }

  async createActivity(payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    
    // ゲストユーザーの場合はローカルストレージに保存
    if (!session?.session?.user) {
      const activity = {
        id: 'activity-' + Date.now(),
        kind: payload.kind,
        habitId: payload.habitId,
        habitName: payload.habitName,
        timestamp: payload.timestamp || new Date().toISOString(),
        amount: payload.amount,
        prevCount: payload.prevCount,
        newCount: payload.newCount,
        durationSeconds: payload.durationSeconds
      };
      
      const existingActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      existingActivities.unshift(activity); // 最新を先頭に
      localStorage.setItem('guest-activities', JSON.stringify(existingActivities));
      
      return activity;
    }
    
    const { data, error } = await supabase
      .from('activities')
      .insert({
        kind: payload.kind,
        habit_id: payload.habitId,
        habit_name: payload.habitName,
        timestamp: payload.timestamp || new Date().toISOString(),
        amount: payload.amount,
        prev_count: payload.prevCount,
        new_count: payload.newCount,
        duration_seconds: payload.durationSeconds,
        owner_type: 'user',
        owner_id: session.session.user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      kind: data.kind,
      habitId: data.habit_id,
      habitName: data.habit_name,
      timestamp: data.timestamp,
      amount: data.amount,
      prevCount: data.prev_count,
      newCount: data.new_count,
      durationSeconds: data.duration_seconds
    };
  }

  async updateActivity(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      const activityIndex = guestActivities.findIndex((a: any) => a.id === id);
      
      if (activityIndex === -1) {
        throw new Error(`Activity with id ${id} not found`);
      }
      
      const updatedActivity = {
        ...guestActivities[activityIndex]
      };
      
      // Update fields if provided
      if (payload.kind !== undefined) updatedActivity.kind = payload.kind;
      if (payload.habitId !== undefined) updatedActivity.habitId = payload.habitId;
      if (payload.habitName !== undefined) updatedActivity.habitName = payload.habitName;
      if (payload.timestamp !== undefined) updatedActivity.timestamp = payload.timestamp;
      if (payload.amount !== undefined) updatedActivity.amount = payload.amount;
      if (payload.prevCount !== undefined) updatedActivity.prevCount = payload.prevCount;
      if (payload.newCount !== undefined) updatedActivity.newCount = payload.newCount;
      if (payload.durationSeconds !== undefined) updatedActivity.durationSeconds = payload.durationSeconds;
      if (payload.memo !== undefined) updatedActivity.memo = payload.memo;
      
      // Update the activity in the array
      guestActivities[activityIndex] = updatedActivity;
      localStorage.setItem('guest-activities', JSON.stringify(guestActivities));
      
      console.log('[updateActivity] Guest activity updated:', updatedActivity);
      return updatedActivity;
    }
    
    // ログインユーザーの場合はSupabaseを更新
    const updateData: any = {};
    
    // Map camelCase to snake_case
    if (payload.kind !== undefined) updateData.kind = payload.kind;
    if (payload.habitId !== undefined) updateData.habit_id = payload.habitId;
    if (payload.habitName !== undefined) updateData.habit_name = payload.habitName;
    if (payload.timestamp !== undefined) updateData.timestamp = payload.timestamp;
    if (payload.amount !== undefined) updateData.amount = payload.amount;
    if (payload.prevCount !== undefined) updateData.prev_count = payload.prevCount;
    if (payload.newCount !== undefined) updateData.new_count = payload.newCount;
    if (payload.durationSeconds !== undefined) updateData.duration_seconds = payload.durationSeconds;
    if (payload.memo !== undefined) updateData.memo = payload.memo;
    
    const { data, error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      kind: data.kind,
      habitId: data.habit_id,
      habitName: data.habit_name,
      timestamp: data.timestamp,
      amount: data.amount,
      prevCount: data.prev_count,
      newCount: data.new_count,
      durationSeconds: data.duration_seconds,
      memo: data.memo
    };
  }

  async deleteActivity(id: string) {
    console.log('[deleteActivity] Starting deletion for activity:', id);
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[deleteActivity] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      console.log('[deleteActivity] Guest user - deleting from localStorage');
      // ゲストユーザーの場合はローカルストレージから削除
      const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      console.log('[deleteActivity] Current guest activities:', guestActivities.length);
      
      const activityIndex = guestActivities.findIndex((a: any) => a.id === id);
      
      if (activityIndex === -1) {
        console.error('[deleteActivity] Guest activity not found:', id);
        throw new Error(`Activity with id ${id} not found`);
      }
      
      console.log('[deleteActivity] Found guest activity at index:', activityIndex);
      
      // Remove the activity from the array
      guestActivities.splice(activityIndex, 1);
      localStorage.setItem('guest-activities', JSON.stringify(guestActivities));
      
      console.log('[deleteActivity] Guest activity deleted. Remaining activities:', guestActivities.length);
      return { success: true };
    }
    
    console.log('[deleteActivity] Authenticated user - deleting from Supabase');
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) {
      console.error('[deleteActivity] Supabase deletion error:', error);
      throw error;
    }
    
    console.log('[deleteActivity] Successfully deleted from Supabase:', id);
    return { success: true };
  }

  // Diary関連のメソッド
  async getDiaryCards() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[getDiaryCards] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestDiaryCards = JSON.parse(localStorage.getItem('guest-diary-cards') || '[]');
      console.log('[getDiaryCards] Guest mode - loaded from localStorage:', guestDiaryCards.length, 'cards');
      return guestDiaryCards;
    }
    
    console.log('[getDiaryCards] Authenticated mode - querying Supabase for user:', session.session.user.id);
    
    // ログインユーザーの場合はSupabaseから取得（シンプル版）
    const { data, error } = await supabase
      .from('diary_cards')
      .select('id, front_md, back_md, created_at, updated_at')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[getDiaryCards] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getDiaryCards] Successfully loaded', data?.length || 0, 'cards from Supabase');
    console.log('[getDiaryCards] Raw data:', data);
    
    return (data || []).map((card: any) => ({
      id: card.id,
      frontMd: card.front_md,
      backMd: card.back_md,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      tags: [], // 簡略化: 空配列
      goals: [], // 簡略化: 空配列
      habits: [] // 簡略化: 空配列
    }));
  }

  async createDiaryCard(payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージに保存
      const now = new Date().toISOString();
      const card = {
        id: 'diary-card-' + Date.now(),
        frontMd: payload.frontMd || '',
        backMd: payload.backMd || '',
        createdAt: now,
        updatedAt: now,
        tags: [], // ゲストモードでは簡略化
        goals: [],
        habits: []
      };
      
      const existingCards = JSON.parse(localStorage.getItem('guest-diary-cards') || '[]');
      existingCards.unshift(card); // 最新を先頭に
      localStorage.setItem('guest-diary-cards', JSON.stringify(existingCards));
      
      console.log('[createDiaryCard] Guest card created:', card);
      return card;
    }
    
    // ログインユーザーの場合はSupabaseに保存
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('diary_cards')
      .insert({
        front_md: payload.frontMd || '',
        back_md: payload.backMd || '',
        owner_type: 'user',
        owner_id: session.session.user.id,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      frontMd: data.front_md,
      backMd: data.back_md,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tags: [],
      goals: [],
      habits: []
    };
  }

  async updateDiaryCard(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestCards = JSON.parse(localStorage.getItem('guest-diary-cards') || '[]');
      const cardIndex = guestCards.findIndex((c: any) => c.id === id);
      
      if (cardIndex === -1) {
        throw new Error(`Diary card with id ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedCard = {
        ...guestCards[cardIndex],
        updatedAt: now
      };
      
      if (payload.frontMd !== undefined) updatedCard.frontMd = payload.frontMd;
      if (payload.backMd !== undefined) updatedCard.backMd = payload.backMd;
      
      guestCards[cardIndex] = updatedCard;
      localStorage.setItem('guest-diary-cards', JSON.stringify(guestCards));
      
      console.log('[updateDiaryCard] Guest card updated:', updatedCard);
      return updatedCard;
    }
    
    // ログインユーザーの場合はSupabaseを更新
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (payload.frontMd !== undefined) updateData.front_md = payload.frontMd;
    if (payload.backMd !== undefined) updateData.back_md = payload.backMd;
    
    const { data, error } = await supabase
      .from('diary_cards')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      frontMd: data.front_md,
      backMd: data.back_md,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      tags: [],
      goals: [],
      habits: []
    };
  }

  async deleteDiaryCard(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestCards = JSON.parse(localStorage.getItem('guest-diary-cards') || '[]');
      const cardIndex = guestCards.findIndex((c: any) => c.id === id);
      
      if (cardIndex === -1) {
        throw new Error(`Diary card with id ${id} not found`);
      }
      
      guestCards.splice(cardIndex, 1);
      localStorage.setItem('guest-diary-cards', JSON.stringify(guestCards));
      
      console.log('[deleteDiaryCard] Guest card deleted:', id);
      return { success: true };
    }
    
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('diary_cards')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async getDiaryTags() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestTags = JSON.parse(localStorage.getItem('guest-diary-tags') || '[]');
      console.log('[getDiaryTags] Guest mode - loaded from localStorage:', guestTags.length, 'tags');
      return guestTags;
    }
    
    // ログインユーザーの場合はSupabaseから取得
    const { data, error } = await supabase
      .from('diary_tags')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('[getDiaryTags] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getDiaryTags] Successfully loaded', data?.length || 0, 'tags from Supabase');
    
    return (data || []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color
    }));
  }

  async createDiaryTag(payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージに保存
      const tag = {
        id: 'diary-tag-' + Date.now(),
        name: payload.name || 'Untitled Tag',
        color: payload.color || null
      };
      
      const existingTags = JSON.parse(localStorage.getItem('guest-diary-tags') || '[]');
      existingTags.push(tag);
      localStorage.setItem('guest-diary-tags', JSON.stringify(existingTags));
      
      console.log('[createDiaryTag] Guest tag created:', tag);
      return tag;
    }
    
    // ログインユーザーの場合はSupabaseに保存
    const { data, error } = await supabase
      .from('diary_tags')
      .insert({
        name: payload.name || 'Untitled Tag',
        color: payload.color || null,
        owner_type: 'user',
        owner_id: session.session.user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      color: data.color
    };
  }

  async updateDiaryTag(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestTags = JSON.parse(localStorage.getItem('guest-diary-tags') || '[]');
      const tagIndex = guestTags.findIndex((t: any) => t.id === id);
      
      if (tagIndex === -1) {
        throw new Error(`Diary tag with id ${id} not found`);
      }
      
      const updatedTag = { ...guestTags[tagIndex] };
      
      if (payload.name !== undefined) updatedTag.name = payload.name;
      if (payload.color !== undefined) updatedTag.color = payload.color;
      
      guestTags[tagIndex] = updatedTag;
      localStorage.setItem('guest-diary-tags', JSON.stringify(guestTags));
      
      console.log('[updateDiaryTag] Guest tag updated:', updatedTag);
      return updatedTag;
    }
    
    // ログインユーザーの場合はSupabaseを更新
    const updateData: any = {};
    
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.color !== undefined) updateData.color = payload.color;
    
    const { data, error } = await supabase
      .from('diary_tags')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      name: data.name,
      color: data.color
    };
  }

  async deleteDiaryTag(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestTags = JSON.parse(localStorage.getItem('guest-diary-tags') || '[]');
      const tagIndex = guestTags.findIndex((t: any) => t.id === id);
      
      if (tagIndex === -1) {
        throw new Error(`Diary tag with id ${id} not found`);
      }
      
      guestTags.splice(tagIndex, 1);
      localStorage.setItem('guest-diary-tags', JSON.stringify(guestTags));
      
      console.log('[deleteDiaryTag] Guest tag deleted:', id);
      return { success: true };
    }
    
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('diary_tags')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async me() {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      return {
        actor: {
          type: 'guest',
          id: 'guest-' + Math.random().toString(36).substr(2, 9)
        }
      };
    }
    
    return {
      actor: {
        type: 'user',
        id: session.session.user.id,
        email: session.session.user.email
      }
    };
  }

  // Placeholder methods for compatibility
  async getLayout() { return { sections: ['next', 'activity', 'calendar', 'statics', 'diary'] }; }
  async setLayout(sections: any[]) { return { sections }; }
  async getPrefs() { return {}; }
  async setPref(key: string, value: any) { return { [key]: value }; }

  // デフォルトゴール作成または取得
  private async getOrCreateDefaultGoal(userId: string): Promise<string> {
    if (!supabase) throw new Error('Supabase not configured');
    
    console.log('[getOrCreateDefaultGoal] Looking for default goal for user:', userId);
    
    // 既存のデフォルトゴールを検索
    const { data: existingGoals, error: searchError } = await supabase
      .from('goals')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('name', 'My Goals')
      .limit(1);
    
    if (searchError) {
      console.error('[getOrCreateDefaultGoal] Search error:', searchError);
      throw searchError;
    }
    
    if (existingGoals && existingGoals.length > 0) {
      console.log('[getOrCreateDefaultGoal] Found existing default goal:', existingGoals[0].id);
      return existingGoals[0].id;
    }
    
    // デフォルトゴールを作成
    console.log('[getOrCreateDefaultGoal] Creating new default goal');
    const now = new Date().toISOString();
    const { data: newGoal, error: createError } = await supabase
      .from('goals')
      .insert({
        name: 'My Goals',
        details: 'Default goal for organizing habits',
        owner_type: 'user',
        owner_id: userId,
        is_completed: false,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (createError) {
      console.error('[getOrCreateDefaultGoal] Create error:', createError);
      throw createError;
    }
    
    console.log('[getOrCreateDefaultGoal] Created new default goal:', newGoal.id);
    return newGoal.id;
  }

  // Mindmap methods
  async getMindmaps() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[getMindmaps] Session check:', { hasSession: !!session?.session, userId: session?.session?.user?.id });
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestMindmaps = JSON.parse(localStorage.getItem('guest-mindmaps') || '[]');
      console.log('[getMindmaps] Guest mode - loaded from localStorage:', guestMindmaps.length, 'mindmaps');
      return guestMindmaps;
    }
    
    console.log('[getMindmaps] Authenticated mode - querying Supabase for user:', session.session.user.id);
    
    const { data, error } = await supabase
      .from('mindmaps')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[getMindmaps] Supabase query error:', error);
      throw error;
    }
    
    console.log('[getMindmaps] Successfully loaded', data?.length || 0, 'mindmaps from Supabase');
    
    // 各MindMapのノードとエッジも取得
    const mindmapsWithData = await Promise.all((data || []).map(async (m: any) => {
      console.log(`[getMindmaps] Loading nodes and edges for mindmap ${m.id}`);
      const nodes = await this.getMindmapNodes(m.id);
      const connections = await this.getMindmapConnections(m.id);
      
      console.log(`[getMindmaps] Mindmap ${m.id} - nodes:`, nodes.length, 'connections:', connections.length);
      console.log(`[getMindmaps] Mindmap ${m.id} - node data:`, nodes);
      console.log(`[getMindmaps] Mindmap ${m.id} - connection data:`, connections);
      
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        nodes: nodes,
        edges: connections,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      };
    }));
    
    console.log('[getMindmaps] Final mindmaps with data:', mindmapsWithData);
    return mindmapsWithData;
  }

  async createMindmap(payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージに保存
      const now = new Date().toISOString();
      const mindmap = {
        id: 'mindmap-' + Date.now(),
        name: payload.name || 'Untitled Map',
        description: payload.description,
        nodes: payload.nodes || [],
        edges: payload.edges || [],
        createdAt: now,
        updatedAt: now
      };
      
      const existingMindmaps = JSON.parse(localStorage.getItem('guest-mindmaps') || '[]');
      existingMindmaps.push(mindmap);
      localStorage.setItem('guest-mindmaps', JSON.stringify(existingMindmaps));
      
      // ノードとエッジもローカルストレージに保存
      if (payload.nodes && payload.nodes.length > 0) {
        const guestNodes = payload.nodes.map((node: any) => ({
          id: node.id,
          mindmapId: mindmap.id,
          text: node.label,
          x: node.position.x,
          y: node.position.y,
          width: 150,
          height: 50,
          color: '#ffffff',
          nodeType: node.nodeType || 'default',
          createdAt: now,
          updatedAt: now
        }));
        const existingNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
        localStorage.setItem('guest-mindmap-nodes', JSON.stringify([...existingNodes, ...guestNodes]));
      }
      
      if (payload.edges && payload.edges.length > 0) {
        const guestConnections = payload.edges.map((edge: any) => ({
          id: edge.id,
          mindmapId: mindmap.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          createdAt: now,
          updatedAt: now
        }));
        const existingConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
        localStorage.setItem('guest-mindmap-connections', JSON.stringify([...existingConnections, ...guestConnections]));
      }
      
      return mindmap;
    }
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('mindmaps')
      .insert({
        name: payload.name || 'Untitled Map',
        description: payload.description,
        owner_type: 'user',
        owner_id: session.session.user.id,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // ノードとエッジを保存
    if (payload.nodes || payload.edges) {
      await this.saveMindmapNodesAndEdges(data.id, payload.nodes || [], payload.edges || [], session.session.user.id);
    }
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateMindmap(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestMindmaps = JSON.parse(localStorage.getItem('guest-mindmaps') || '[]');
      const mindmapIndex = guestMindmaps.findIndex((m: any) => m.id === id);
      
      if (mindmapIndex === -1) {
        throw new Error(`Mindmap with id ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedMindmap = {
        ...guestMindmaps[mindmapIndex],
        updatedAt: now
      };
      
      if (payload.name !== undefined) updatedMindmap.name = payload.name;
      if (payload.description !== undefined) updatedMindmap.description = payload.description;
      if (payload.nodes !== undefined) updatedMindmap.nodes = payload.nodes;
      if (payload.edges !== undefined) updatedMindmap.edges = payload.edges;
      
      guestMindmaps[mindmapIndex] = updatedMindmap;
      localStorage.setItem('guest-mindmaps', JSON.stringify(guestMindmaps));
      
      // ノードとエッジもローカルストレージに保存
      if (payload.nodes) {
        const guestNodes = payload.nodes.map((node: any) => ({
          id: node.id,
          mindmapId: id,
          text: node.label,
          x: node.position.x,
          y: node.position.y,
          width: 150,
          height: 50,
          color: '#ffffff',
          nodeType: node.nodeType || 'default',
          createdAt: now,
          updatedAt: now
        }));
        localStorage.setItem('guest-mindmap-nodes', JSON.stringify(guestNodes));
      }
      
      if (payload.edges) {
        const guestConnections = payload.edges.map((edge: any) => ({
          id: edge.id,
          mindmapId: id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          createdAt: now,
          updatedAt: now
        }));
        localStorage.setItem('guest-mindmap-connections', JSON.stringify(guestConnections));
      }
      
      return updatedMindmap;
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    
    // Mindmapメタデータを更新
    const { data, error } = await supabase
      .from('mindmaps')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    // ノードとエッジを保存
    if (payload.nodes || payload.edges) {
      await this.saveMindmapNodesAndEdges(id, payload.nodes || [], payload.edges || [], session.session.user.id);
    }
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // ノードとエッジを保存するヘルパーメソッド
  private async saveMindmapNodesAndEdges(mindmapId: string, nodes: any[], edges: any[], userId: string) {
    const now = new Date().toISOString();
    
    console.log('[saveMindmapNodesAndEdges] Starting save process:', {
      mindmapId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      userId
    });
    
    try {
      // 既存のノードとエッジを削除
      console.log('[saveMindmapNodesAndEdges] Deleting existing nodes...');
      const { error: deleteNodesError } = await supabase
        .from('mindmap_nodes')
        .delete()
        .eq('mindmap_id', mindmapId)
        .eq('owner_type', 'user')
        .eq('owner_id', userId);
        
      if (deleteNodesError) {
        console.error('[saveMindmapNodesAndEdges] Error deleting nodes:', deleteNodesError);
        throw deleteNodesError;
      }
        
      console.log('[saveMindmapNodesAndEdges] Deleting existing connections...');
      const { error: deleteConnectionsError } = await supabase
        .from('mindmap_connections')
        .delete()
        .eq('mindmap_id', mindmapId)
        .eq('owner_type', 'user')
        .eq('owner_id', userId);
        
      if (deleteConnectionsError) {
        console.error('[saveMindmapNodesAndEdges] Error deleting connections:', deleteConnectionsError);
        throw deleteConnectionsError;
      }
      
      // 新しいノードを挿入
      if (nodes.length > 0) {
        console.log('[saveMindmapNodesAndEdges] Inserting nodes:', nodes);
        const nodeData = nodes.map(node => ({
          id: node.id,
          mindmap_id: mindmapId,
          text: node.label || '',
          x: node.position?.x || 0,
          y: node.position?.y || 0,
          width: 150,
          height: 50,
          color: '#ffffff',
          owner_type: 'user',
          owner_id: userId,
          created_at: now,
          updated_at: now
        }));
        
        console.log('[saveMindmapNodesAndEdges] Node data to insert:', nodeData);
        
        const { error: nodesError } = await supabase
          .from('mindmap_nodes')
          .insert(nodeData);
          
        if (nodesError) {
          console.error('[saveMindmapNodesAndEdges] Failed to save nodes:', nodesError);
          throw nodesError;
        }
        
        console.log('[saveMindmapNodesAndEdges] Nodes saved successfully');
      }
      
      // 新しいエッジを挿入
      if (edges.length > 0) {
        console.log('[saveMindmapNodesAndEdges] Inserting edges:', edges);
        
        // スキーマに合わせてカラム名を修正
        const edgeData = edges.map(edge => ({
          id: edge.id,
          mindmap_id: mindmapId,
          from_node_id: edge.source,  // source_node_id -> from_node_id
          to_node_id: edge.target,    // target_node_id -> to_node_id
          owner_type: 'user',
          owner_id: userId,
          created_at: now,
          updated_at: now
        }));
        
        console.log('[saveMindmapNodesAndEdges] Edge data to insert:', edgeData);
        
        const { error: edgesError } = await supabase
          .from('mindmap_connections')
          .insert(edgeData);
          
        if (edgesError) {
          console.error('[saveMindmapNodesAndEdges] Failed to save edges:', edgesError);
          throw edgesError;
        }
        
        console.log('[saveMindmapNodesAndEdges] Edges saved successfully');
      }
      
      console.log('[saveMindmapNodesAndEdges] Save process completed successfully');
    } catch (error) {
      console.error('[saveMindmapNodesAndEdges] Save process failed:', error);
      throw error;
    }
  }

  async deleteMindmap(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestMindmaps = JSON.parse(localStorage.getItem('guest-mindmaps') || '[]');
      const mindmapIndex = guestMindmaps.findIndex((m: any) => m.id === id);
      
      if (mindmapIndex === -1) {
        throw new Error(`Mindmap with id ${id} not found`);
      }
      
      guestMindmaps.splice(mindmapIndex, 1);
      localStorage.setItem('guest-mindmaps', JSON.stringify(guestMindmaps));
      
      // Also remove related nodes and connections
      const guestNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
      const filteredNodes = guestNodes.filter((n: any) => n.mindmapId !== id);
      localStorage.setItem('guest-mindmap-nodes', JSON.stringify(filteredNodes));
      
      const guestConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
      const filteredConnections = guestConnections.filter((c: any) => c.mindmapId !== id);
      localStorage.setItem('guest-mindmap-connections', JSON.stringify(filteredConnections));
      
      return { success: true };
    }
    
    const { error } = await supabase
      .from('mindmaps')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async getMindmapNodes(mindmapId: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
      return guestNodes.filter((n: any) => n.mindmapId === mindmapId);
    }
    
    const { data, error } = await supabase
      .from('mindmap_nodes')
      .select('*')
      .eq('mindmap_id', mindmapId)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    
    return (data || []).map((n: any) => ({
      id: n.id,
      mindmapId: n.mindmap_id,
      text: n.text,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      color: n.color,
      goalId: n.goal_id,
      habitId: n.habit_id,
      createdAt: n.created_at,
      updatedAt: n.updated_at
    }));
  }

  async createMindmapNode(mindmapId: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージに保存
      const now = new Date().toISOString();
      const node = {
        id: 'node-' + Date.now(),
        mindmapId,
        text: payload.text || 'New Node',
        x: payload.x || 0,
        y: payload.y || 0,
        width: payload.width || 120,
        height: payload.height || 60,
        color: payload.color || '#ffffff',
        goalId: payload.goalId || null,
        habitId: payload.habitId || null,
        createdAt: now,
        updatedAt: now
      };
      
      const existingNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
      existingNodes.push(node);
      localStorage.setItem('guest-mindmap-nodes', JSON.stringify(existingNodes));
      
      return node;
    }
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('mindmap_nodes')
      .insert({
        mindmap_id: mindmapId,
        text: payload.text || 'New Node',
        x: payload.x || 0,
        y: payload.y || 0,
        width: payload.width || 120,
        height: payload.height || 60,
        color: payload.color || '#ffffff',
        goal_id: payload.goalId || null,
        habit_id: payload.habitId || null,
        owner_type: 'user',
        owner_id: session.session.user.id,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      mindmapId: data.mindmap_id,
      text: data.text,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      color: data.color,
      goalId: data.goal_id,
      habitId: data.habit_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async updateMindmapNode(id: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージを更新
      const guestNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
      const nodeIndex = guestNodes.findIndex((n: any) => n.id === id);
      
      if (nodeIndex === -1) {
        throw new Error(`Node with id ${id} not found`);
      }
      
      const now = new Date().toISOString();
      const updatedNode = {
        ...guestNodes[nodeIndex],
        updatedAt: now
      };
      
      if (payload.text !== undefined) updatedNode.text = payload.text;
      if (payload.x !== undefined) updatedNode.x = payload.x;
      if (payload.y !== undefined) updatedNode.y = payload.y;
      if (payload.width !== undefined) updatedNode.width = payload.width;
      if (payload.height !== undefined) updatedNode.height = payload.height;
      if (payload.color !== undefined) updatedNode.color = payload.color;
      if (payload.goalId !== undefined) updatedNode.goalId = payload.goalId;
      if (payload.habitId !== undefined) updatedNode.habitId = payload.habitId;
      
      guestNodes[nodeIndex] = updatedNode;
      localStorage.setItem('guest-mindmap-nodes', JSON.stringify(guestNodes));
      
      return updatedNode;
    }
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (payload.text !== undefined) updateData.text = payload.text;
    if (payload.x !== undefined) updateData.x = payload.x;
    if (payload.y !== undefined) updateData.y = payload.y;
    if (payload.width !== undefined) updateData.width = payload.width;
    if (payload.height !== undefined) updateData.height = payload.height;
    if (payload.color !== undefined) updateData.color = payload.color;
    if (payload.goalId !== undefined) updateData.goal_id = payload.goalId;
    if (payload.habitId !== undefined) updateData.habit_id = payload.habitId;
    
    const { data, error } = await supabase
      .from('mindmap_nodes')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      mindmapId: data.mindmap_id,
      text: data.text,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      color: data.color,
      goalId: data.goal_id,
      habitId: data.habit_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async deleteMindmapNode(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestNodes = JSON.parse(localStorage.getItem('guest-mindmap-nodes') || '[]');
      const nodeIndex = guestNodes.findIndex((n: any) => n.id === id);
      
      if (nodeIndex === -1) {
        throw new Error(`Node with id ${id} not found`);
      }
      
      guestNodes.splice(nodeIndex, 1);
      localStorage.setItem('guest-mindmap-nodes', JSON.stringify(guestNodes));
      
      // Also remove related connections
      const guestConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
      const filteredConnections = guestConnections.filter((c: any) => c.fromNodeId !== id && c.toNodeId !== id);
      localStorage.setItem('guest-mindmap-connections', JSON.stringify(filteredConnections));
      
      return { success: true };
    }
    
    const { error } = await supabase
      .from('mindmap_nodes')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  async getMindmapConnections(mindmapId: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
      return guestConnections.filter((c: any) => c.mindmapId === mindmapId);
    }
    
    const { data, error } = await supabase
      .from('mindmap_connections')
      .select('*')
      .eq('mindmap_id', mindmapId)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    
    return (data || []).map((c: any) => ({
      id: c.id,
      mindmapId: c.mindmap_id,
      fromNodeId: c.from_node_id,
      toNodeId: c.to_node_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
  }

  async createMindmapConnection(mindmapId: string, payload: any) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージに保存
      const now = new Date().toISOString();
      const connection = {
        id: 'connection-' + Date.now(),
        mindmapId,
        fromNodeId: payload.fromNodeId,
        toNodeId: payload.toNodeId,
        createdAt: now,
        updatedAt: now
      };
      
      const existingConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
      existingConnections.push(connection);
      localStorage.setItem('guest-mindmap-connections', JSON.stringify(existingConnections));
      
      return connection;
    }
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('mindmap_connections')
      .insert({
        mindmap_id: mindmapId,
        from_node_id: payload.fromNodeId,
        to_node_id: payload.toNodeId,
        owner_type: 'user',
        owner_id: session.session.user.id,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      mindmapId: data.mindmap_id,
      fromNodeId: data.from_node_id,
      toNodeId: data.to_node_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async deleteMindmapConnection(id: string) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestConnections = JSON.parse(localStorage.getItem('guest-mindmap-connections') || '[]');
      const connectionIndex = guestConnections.findIndex((c: any) => c.id === id);
      
      if (connectionIndex === -1) {
        throw new Error(`Connection with id ${id} not found`);
      }
      
      guestConnections.splice(connectionIndex, 1);
      localStorage.setItem('guest-mindmap-connections', JSON.stringify(guestConnections));
      
      return { success: true };
    }
    
    const { error } = await supabase
      .from('mindmap_connections')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }
}

export const supabaseDirectClient = new SupabaseDirectClient();