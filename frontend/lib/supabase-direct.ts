import { supabase } from './supabaseClient';

// Supabase direct client - 本番環境では完全に無効化
export class SupabaseDirectClient {
  private checkEnvironment() {
    // 本番環境では常にエラーを投げる
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Supabase Direct Client is completely disabled in production to prevent CORS issues. All data operations must use Next.js API Routes.');
    }
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
  }

  async getGoals() {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    this.checkEnvironment();
    
    const { data: session } = await supabase.auth.getSession();
    
    if (!session?.session?.user) {
      throw new Error('Authentication required. Please sign in to save your data.');
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
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
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
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
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
    if (!session?.session?.user) {
      return [];
    }
    
    const { data, error } = await supabase
      .from('habits')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', session.session.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Convert snake_case to camelCase
    return (data || []).map((h: any) => ({
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
  }

  async createHabit(payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    console.log('[createHabit] Starting habit creation:', payload);
    
    const { data: session } = await supabase.auth.getSession();
    console.log('[createHabit] Session check:', session?.session?.user ? 'Authenticated' : 'Not authenticated');
    
    // 認証が必要
    if (!session?.session?.user) {
      const error = 'Authentication required. Please sign in to save your habits.';
      console.error('[createHabit] Error:', error);
      throw new Error(error);
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
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
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
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
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
      return [];
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
    
    // 認証が必要
    if (!session?.session?.user) {
      throw new Error('Authentication required. Please sign in to save your activities.');
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