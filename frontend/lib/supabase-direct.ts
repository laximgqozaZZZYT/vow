import { supabase } from './supabaseClient';

// Supabase direct client - 本番環境では完全に無効化
export class SupabaseDirectClient {
  private checkEnvironment() {
    // 本番環境でも動作するように変更（ゲストユーザー対応）
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
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
    console.log('[getGoals] Goals data:', data);
    
    return data || [];
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
      
      // Update fields if provided (map camelCase to match guest format)
      if (payload.name !== undefined) updatedHabit.name = payload.name;
      if (payload.active !== undefined) updatedHabit.active = payload.active;
      if (payload.count !== undefined) updatedHabit.count = payload.count;
      if (payload.completed !== undefined) updatedHabit.completed = payload.completed;
      if (payload.lastCompletedAt !== undefined) updatedHabit.lastCompletedAt = payload.lastCompletedAt;
      if (payload.type !== undefined) updatedHabit.type = payload.type;
      if (payload.must !== undefined) updatedHabit.must = payload.must;
      if (payload.duration !== undefined) updatedHabit.duration = payload.duration;
      if (payload.reminders !== undefined) updatedHabit.reminders = payload.reminders;
      if (payload.dueDate !== undefined) updatedHabit.dueDate = payload.dueDate;
      if (payload.time !== undefined) updatedHabit.time = payload.time;
      if (payload.endTime !== undefined) updatedHabit.endTime = payload.endTime;
      if (payload.repeat !== undefined) updatedHabit.repeat = payload.repeat;
      if (payload.timings !== undefined) updatedHabit.timings = payload.timings;
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
    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    // Map camelCase to snake_case
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.active !== undefined) updateData.active = payload.active;
    if (payload.count !== undefined) updateData.count = payload.count;
    if (payload.completed !== undefined) updateData.completed = payload.completed;
    if (payload.lastCompletedAt !== undefined) updateData.last_completed_at = payload.lastCompletedAt;
    
    const { data, error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return {
      id: data.id,
      goalId: data.goal_id,
      name: data.name,
      active: data.active,
      type: data.type,
      count: data.count,
      must: data.must,
      completed: data.completed,
      lastCompletedAt: data.last_completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
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
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      return guestActivities;
    }
    
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((a: any) => ({
      id: a.id,
      kind: a.kind,
      habitId: a.habit_id,
      habitName: a.habit_name,
      timestamp: a.timestamp,
      amount: a.amount,
      prevCount: a.prev_count,
      newCount: a.new_count,
      durationSeconds: a.duration_seconds
    }));
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
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから削除
      const guestActivities = JSON.parse(localStorage.getItem('guest-activities') || '[]');
      const activityIndex = guestActivities.findIndex((a: any) => a.id === id);
      
      if (activityIndex === -1) {
        throw new Error(`Activity with id ${id} not found`);
      }
      
      // Remove the activity from the array
      guestActivities.splice(activityIndex, 1);
      localStorage.setItem('guest-activities', JSON.stringify(guestActivities));
      
      console.log('[deleteActivity] Guest activity deleted:', id);
      return { success: true };
    }
    
    // ログインユーザーの場合はSupabaseから削除
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id);
    
    if (error) throw error;
    return { success: true };
  }

  // Diary関連のメソッド
  async getDiaryCards() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      // ゲストユーザーの場合はローカルストレージから取得
      const guestDiaryCards = JSON.parse(localStorage.getItem('guest-diary-cards') || '[]');
      console.log('[getDiaryCards] Guest mode - loaded from localStorage:', guestDiaryCards.length, 'cards');
      return guestDiaryCards;
    }
    
    // ログインユーザーの場合はSupabaseから取得
    const { data, error } = await supabase
      .from('diary_cards')
      .select(`
        *,
        diary_card_tags!inner(
          diary_tags(*)
        ),
        diary_card_goals!inner(
          goals(*)
        ),
        diary_card_habits!inner(
          habits(*)
        )
      `)
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((card: any) => ({
      id: card.id,
      frontMd: card.front_md,
      backMd: card.back_md,
      createdAt: card.created_at,
      updatedAt: card.updated_at,
      tags: card.diary_card_tags?.map((ct: any) => ({
        id: ct.diary_tags.id,
        name: ct.diary_tags.name,
        color: ct.diary_tags.color
      })) || [],
      goals: card.diary_card_goals?.map((cg: any) => ({
        goalId: cg.goals.id,
        name: cg.goals.name
      })) || [],
      habits: card.diary_card_habits?.map((ch: any) => ({
        habitId: ch.habits.id,
        name: ch.habits.name
      })) || []
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
    
    if (error) throw error;
    
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
}

export const supabaseDirectClient = new SupabaseDirectClient();