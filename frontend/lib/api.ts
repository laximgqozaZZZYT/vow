// Supabase統合版API - 実際のデータベーススキーマに基づく実装

// 型定義をエクスポート
export type DiaryCard = {
  id: string;
  frontMd: string;
  backMd: string;
  createdAt: string;
  updatedAt: string;
  tags?: DiaryTag[];
  goals?: any[];
  habits?: any[];
};

export type DiaryTag = {
  id: string;
  name: string;
  color?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') || ''
const USE_EDGE_FUNCTIONS = process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS === 'true'

// デバッグ用ログ
if (typeof window !== 'undefined') {
  console.log('=== API Configuration Debug (Supabase Integrated) ===');
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('USE_EDGE_FUNCTIONS:', USE_EDGE_FUNCTIONS);
  
  const apiChoice = USE_EDGE_FUNCTIONS ? 'Supabase Edge Functions' : 'Supabase Client Direct';
  console.log('🚀 Using:', apiChoice);
}

class ApiError extends Error {
  url: string;
  status?: number;
  body?: string;

  constructor(message: string, url: string, opts: { status?: number; body?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = opts.status;
    this.body = opts.body;
  }
}

function safeJsonParse(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text) } catch { return text }
}

// Supabase統合版のリクエスト処理
async function request(path: string, opts: RequestInit = {}) {
  if (USE_EDGE_FUNCTIONS) {
    // Edge Functions使用
    const url = `${SUPABASE_URL}/functions/v1${path}`;
    
    try {
      const { supabase } = await import('./supabaseClient');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(opts.headers as Record<string, string> || {}),
      };
      
      // Supabaseセッションからトークンを取得
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }
      }
      
      const res = await fetch(url, {
        ...opts,
        headers,
      });

      const text = await res.text();
      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status} ${res.statusText}`, url, { status: res.status, body: text });
      }

      return safeJsonParse(text);
    } catch (err: any) {
      if (err?.name === 'ApiError') throw err;
      const message = err?.message ? String(err.message) : String(err);
      throw new ApiError(`Failed to fetch (${message})`, url);
    }
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) {
      throw new ApiError('Supabase client not available', path);
    }
    
    // パスに基づいてSupabaseクライアントメソッドを呼び出し
    // この部分は各API関数で個別に実装
    throw new ApiError('Direct Supabase client calls should be handled in individual API functions', path);
  }
}

// Goals API - 実際のスキーマに基づく実装
export async function getGoals() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/goals');
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[getGoals] Database error:', error.message);
        throw new Error(error.message);
      }
      
      console.log('[getGoals] Successfully loaded', data?.length || 0, 'goals');
      
      // Transform snake_case to camelCase for frontend compatibility
      const transformedData = (data || []).map((goal: any) => ({
        ...goal,
        parentId: goal.parent_id,
        isCompleted: goal.is_completed,
        dueDate: goal.due_date ? (
          typeof goal.due_date === 'string' && goal.due_date.includes('T') 
            ? goal.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
            : goal.due_date
        ) : goal.due_date,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at,
      }));
      
      return transformedData;
    } catch (error) {
      console.error('[getGoals] Failed to load goals:', error);
      throw error;
    }
  }
}

export async function createGoal(payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/goals', { method: 'POST', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const goalData = {
      name: payload.name,
      details: payload.details,
      parent_id: payload.parentId,
      owner_type: 'user',
      owner_id: user.id,
      due_date: payload.dueDate ? (
        typeof payload.dueDate === 'string' && payload.dueDate.match(/^\d{4}-\d{2}-\d{2}$/) 
          ? payload.dueDate 
          : (() => {
              const date = new Date(payload.dueDate);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            })()
      ) : null,
    };
    
    console.log('[createGoal] Creating goal with data:', goalData);
    
    const { data, error } = await supabase
      .from('goals')
      .insert(goalData)
      .select()
      .single();
    
    if (error) {
      console.error('[createGoal] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[createGoal] Successfully created goal:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      parentId: data.parent_id,
      isCompleted: data.is_completed,
      dueDate: data.due_date ? (
        typeof data.due_date === 'string' && data.due_date.includes('T') 
          ? data.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
          : data.due_date
      ) : data.due_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return transformedData;
  }
}

export async function updateGoal(id: string, payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.details !== undefined) updateData.details = payload.details;
    if (payload.isCompleted !== undefined) updateData.is_completed = payload.isCompleted;
    if (payload.dueDate !== undefined) {
      if (payload.dueDate) {
        if (typeof payload.dueDate === 'string' && payload.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          updateData.due_date = payload.dueDate;
        } else {
          const date = new Date(payload.dueDate);
          updateData.due_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      } else {
        updateData.due_date = null;
      }
    }
    if (payload.parentId !== undefined) updateData.parent_id = payload.parentId;
    
    console.log('[updateGoal] Updating goal', id, 'with data:', updateData);
    
    const { data, error } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateGoal] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[updateGoal] Successfully updated goal:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      parentId: data.parent_id,
      isCompleted: data.is_completed,
      dueDate: data.due_date ? (
        typeof data.due_date === 'string' && data.due_date.includes('T') 
          ? data.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
          : data.due_date
      ) : data.due_date,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return transformedData;
  }
}

export async function deleteGoal(id: string) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/goals/${id}`, { method: 'DELETE' });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

// Habits API - 実際のスキーマに基づく実装
export async function getHabits() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/habits');
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[getHabits] Database error:', error.message);
        throw new Error(error.message);
      }
      
      console.log('[getHabits] Successfully loaded', data?.length || 0, 'habits');
      
      // Transform snake_case to camelCase for frontend compatibility
      const transformedData = (data || []).map((habit: any) => ({
        ...habit,
        goalId: habit.goal_id,
        createdAt: habit.created_at,
        updatedAt: habit.updated_at,
        dueDate: habit.due_date ? (
          typeof habit.due_date === 'string' && habit.due_date.includes('T') 
            ? habit.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
            : habit.due_date
        ) : habit.due_date,
        endTime: habit.end_time,
        allDay: habit.all_day,
        lastCompletedAt: habit.last_completed_at,
        workloadUnit: habit.workload_unit,
        workloadTotal: habit.workload_total,
        workloadPerCount: habit.workload_per_count,
      }));
      
      return transformedData;
    } catch (error) {
      console.error('[getHabits] Failed to load habits:', error);
      throw error;
    }
  }
}

export async function createHabit(payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/habits', { method: 'POST', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // 基本的なフィールドのみ設定（実際のスキーマに存在するもの）
    const habitData: any = {
      goal_id: payload.goalId,
      name: payload.name,
      type: payload.type,
      active: true,
      count: 0,
      owner_type: 'user',
      owner_id: user.id,
    };
    
    // オプショナルなフィールドを追加（実際のスキーマに存在するもののみ）
    if (payload.must !== undefined) habitData.must = payload.must;
    if (payload.duration !== undefined) habitData.duration = payload.duration;
    if (payload.notes !== undefined) habitData.notes = payload.notes;
    if (payload.dueDate) {
      if (typeof payload.dueDate === 'string' && payload.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        habitData.due_date = payload.dueDate;
      } else {
        const date = new Date(payload.dueDate);
        habitData.due_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      }
    }
    if (payload.time) habitData.time = payload.time;
    if (payload.endTime) habitData.end_time = payload.endTime;
    if (payload.repeat) habitData.repeat = payload.repeat;
    if (payload.reminders) habitData.reminders = payload.reminders;
    if (payload.timings) habitData.timings = payload.timings;
    if (payload.outdates) habitData.outdates = payload.outdates;
    if (payload.allDay !== undefined) habitData.all_day = payload.allDay;
    if (payload.workloadUnit) habitData.workload_unit = payload.workloadUnit;
    if (payload.workloadTotal !== undefined) habitData.workload_total = payload.workloadTotal;
    if (payload.workloadPerCount !== undefined) habitData.workload_per_count = payload.workloadPerCount;
    
    const { data, error } = await supabase
      .from('habits')
      .insert(habitData)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      goalId: data.goal_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      dueDate: data.due_date ? (
        typeof data.due_date === 'string' && data.due_date.includes('T') 
          ? data.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
          : data.due_date
      ) : data.due_date,
      endTime: data.end_time,
      allDay: data.all_day,
      lastCompletedAt: data.last_completed_at,
      workloadUnit: data.workload_unit,
      workloadTotal: data.workload_total,
      workloadPerCount: data.workload_per_count,
    };
    
    return transformedData;
  }
}

export async function updateHabit(id: string, payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const updateData: any = {};
    
    // Support calendar drag/resize updates for a specific timing row.
    // Frontend may send: { dueDate, time, endTime, timingIndex }
    const timingIndexRaw = payload.timingIndex;
    
    console.log('[updateHabit] Processing payload:', payload);
    console.log('[updateHabit] timingIndexRaw:', timingIndexRaw);
    
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.active !== undefined) updateData.active = payload.active;
    if (payload.count !== undefined) updateData.count = payload.count;
    if (payload.must !== undefined) updateData.must = payload.must;
    if (payload.duration !== undefined) updateData.duration = payload.duration;
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.completed !== undefined) updateData.completed = payload.completed;
    if (payload.lastCompletedAt) updateData.last_completed_at = new Date(payload.lastCompletedAt).toISOString();
    
    // 追加のフィールドをサポート
    if (payload.type !== undefined) updateData.type = payload.type;
    if (payload.goalId !== undefined) updateData.goal_id = payload.goalId;
    if (payload.dueDate !== undefined) {
      // Handle date strings properly - don't convert to ISO if it's already a date string
      if (payload.dueDate) {
        if (typeof payload.dueDate === 'string' && payload.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Already in YYYY-MM-DD format, use as-is
          updateData.due_date = payload.dueDate;
        } else {
          // Convert to YYYY-MM-DD format without timezone conversion
          const date = new Date(payload.dueDate);
          updateData.due_date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      } else {
        updateData.due_date = null;
      }
    }
    
    // Handle time fields - these should be updated regardless of timingIndex
    if (payload.time !== undefined) updateData.time = payload.time;
    if (payload.endTime !== undefined) updateData.end_time = payload.endTime;
    
    if (payload.repeat !== undefined) updateData.repeat = payload.repeat;
    if (payload.reminders !== undefined) updateData.reminders = payload.reminders;
    if (payload.timings !== undefined) updateData.timings = payload.timings;
    if (payload.outdates !== undefined) updateData.outdates = payload.outdates;
    if (payload.allDay !== undefined) updateData.all_day = payload.allDay;
    if (payload.workloadUnit !== undefined) updateData.workload_unit = payload.workloadUnit;
    if (payload.workloadTotal !== undefined) updateData.workload_total = payload.workloadTotal;
    if (payload.workloadPerCount !== undefined) updateData.workload_per_count = payload.workloadPerCount;
    
    // Handle timingIndex - similar to backend logic
    if (timingIndexRaw !== undefined) {
      const timingIndex = Number(timingIndexRaw);
      if (!Number.isNaN(timingIndex)) {
        console.log('[updateHabit] Processing timingIndex:', timingIndex);
        
        // First, get the current habit to access its timings
        const { data: existing, error: fetchError } = await supabase
          .from('habits')
          .select('timings')
          .eq('id', id)
          .single();
        
        if (fetchError) {
          console.error('[updateHabit] Failed to fetch existing habit:', fetchError.message);
          throw new Error(fetchError.message);
        }
        
        if (existing) {
          const timings = Array.isArray(existing.timings) ? [...existing.timings] : [];
          console.log('[updateHabit] Current timings:', timings);
          
          if (timings[timingIndex]) {
            const t = { ...timings[timingIndex] };
            
            // The UI uses dueDate/time/endTime; timing rows use date/start/end.
            if (payload.dueDate !== undefined) {
              // Ensure date is in YYYY-MM-DD format without timezone conversion
              let dateStr = payload.dueDate;
              if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Already in YYYY-MM-DD format
                t.date = dateStr;
              } else {
                // Convert to YYYY-MM-DD format without timezone issues
                const date = new Date(dateStr);
                t.date = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              }
              console.log('[updateHabit] Updated timing date:', t.date);
            }
            if (payload.time !== undefined) {
              t.start = payload.time;
              console.log('[updateHabit] Updated timing start:', t.start);
            }
            if (payload.endTime !== undefined) {
              t.end = payload.endTime;
              console.log('[updateHabit] Updated timing end:', t.end);
            }
            
            timings[timingIndex] = t;
            updateData.timings = timings;
            
            console.log('[updateHabit] Updated timings array:', timings);
          } else {
            console.warn('[updateHabit] Timing index out of bounds:', timingIndex, 'in', timings);
          }
        }
      }
    } else {
      console.log('[updateHabit] No timingIndex - updating basic fields only');
    }
    
    console.log('[updateHabit] Final updateData:', updateData);
    
    console.log('[updateHabit] Updating habit', id, 'with data:', updateData);
    
    const { data, error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateHabit] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[updateHabit] Successfully updated habit:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      goalId: data.goal_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      dueDate: data.due_date ? (
        typeof data.due_date === 'string' && data.due_date.includes('T') 
          ? data.due_date.slice(0, 10)  // Extract YYYY-MM-DD from ISO string
          : data.due_date
      ) : data.due_date,
      endTime: data.end_time,
      allDay: data.all_day,
      lastCompletedAt: data.last_completed_at,
      workloadUnit: data.workload_unit,
      workloadTotal: data.workload_total,
      workloadPerCount: data.workload_per_count,
    };
    
    return transformedData;
  }
}

export async function deleteHabit(id: string) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/habits/${id}`, { method: 'DELETE' });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

// Activities API - 実際のスキーマに基づく実装（timestampカラムを使用）
export async function getActivities() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/activities');
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('timestamp', { ascending: false });
      
      if (error) {
        console.error('[getActivities] Database error:', error.message);
        throw new Error(error.message);
      }
      
      console.log('[getActivities] Successfully loaded', data?.length || 0, 'activities');
      
      // Transform snake_case to camelCase for frontend compatibility
      const transformedData = (data || []).map((activity: any) => ({
        ...activity,
        habitId: activity.habit_id,
        habitName: activity.habit_name,
        prevCount: activity.prev_count,
        newCount: activity.new_count,
        durationSeconds: activity.duration_seconds,
      }));
      
      return transformedData;
    } catch (error) {
      console.error('[getActivities] Failed to load activities:', error);
      throw error;
    }
  }
}

export async function createActivity(payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/activities', { method: 'POST', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    // 基本的なフィールドのみ設定（実際のスキーマに存在するもの）
    const activityData: any = {
      kind: payload.kind,
      habit_id: payload.habitId,
      habit_name: payload.habitName,
      owner_type: 'user',
      owner_id: user.id,
    };
    
    // オプショナルなフィールドを追加（実際のスキーマに存在するもののみ）
    if (payload.timestamp) activityData.timestamp = new Date(payload.timestamp).toISOString();
    if (payload.amount !== undefined) activityData.amount = payload.amount;
    if (payload.prevCount !== undefined) activityData.prev_count = payload.prevCount;
    if (payload.newCount !== undefined) activityData.new_count = payload.newCount;
    if (payload.durationSeconds !== undefined) activityData.duration_seconds = payload.durationSeconds;
    
    console.log('[createActivity] Creating activity with data:', activityData);
    
    const { data, error } = await supabase
      .from('activities')
      .insert(activityData)
      .select()
      .single();
    
    if (error) {
      console.error('[createActivity] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[createActivity] Successfully created activity:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      habitId: data.habit_id,
      habitName: data.habit_name,
      prevCount: data.prev_count,
      newCount: data.new_count,
      durationSeconds: data.duration_seconds,
    };
    
    return transformedData;
  }
}

export async function updateActivity(id: string, payload: any) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    // payloadをsnake_caseに変換
    const updateData: any = {};
    if (payload.kind !== undefined) updateData.kind = payload.kind;
    if (payload.habitId !== undefined) updateData.habit_id = payload.habitId;
    if (payload.habitName !== undefined) updateData.habit_name = payload.habitName;
    if (payload.timestamp !== undefined) updateData.timestamp = payload.timestamp;
    if (payload.amount !== undefined) updateData.amount = payload.amount;
    if (payload.prevCount !== undefined) updateData.prev_count = payload.prevCount;
    if (payload.newCount !== undefined) updateData.new_count = payload.newCount;
    if (payload.durationSeconds !== undefined) updateData.duration_seconds = payload.durationSeconds;
    
    // snake_caseフィールドも直接サポート
    if (payload.habit_id !== undefined) updateData.habit_id = payload.habit_id;
    if (payload.habit_name !== undefined) updateData.habit_name = payload.habit_name;
    if (payload.prev_count !== undefined) updateData.prev_count = payload.prev_count;
    if (payload.new_count !== undefined) updateData.new_count = payload.new_count;
    if (payload.duration_seconds !== undefined) updateData.duration_seconds = payload.duration_seconds;
    
    console.log('[updateActivity] Updating activity', id, 'with data:', updateData);
    
    const { data, error } = await supabase
      .from('activities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateActivity] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[updateActivity] Successfully updated activity:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      habitId: data.habit_id,
      habitName: data.habit_name,
      prevCount: data.prev_count,
      newCount: data.new_count,
      durationSeconds: data.duration_seconds,
    };
    
    return transformedData;
  }
}

export async function deleteActivity(id: string) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/activities/${id}`, { method: 'DELETE' });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

export async function me() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/me');
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) {
      return { 
        actor: { type: 'none', id: null },
        error: 'Supabase client not available'
      };
    }
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.warn('[me] Auth error:', error.message);
        return { 
          actor: { type: 'none', id: null },
          error: error.message
        };
      }
      
      if (!user) {
        return { 
          actor: { type: 'none', id: null },
          error: 'Not authenticated'
        };
      }
      
      return { 
        actor: { 
          type: 'user', 
          id: user.id 
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email
        }
      };
    } catch (error) {
      console.error('[me] Unexpected error:', error);
      return { 
        actor: { type: 'none', id: null },
        error: 'Authentication check failed'
      };
    }
  }
}

export async function getLayout() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/layout');
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // ユーザーが認証されていない場合はデフォルトレイアウトを返す
        return { sections: ['next', 'activity', 'calendar', 'statics', 'diary'] };
      }
      
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('key', 'pageSections')
        .eq('owner_type', 'user')
        .eq('owner_id', user.id);
      
      if (error) {
        console.warn('[getLayout] Preferences query failed:', error.message);
        // エラーの場合はデフォルトレイアウトを返す
        return { sections: ['next', 'activity', 'calendar', 'statics', 'diary'] };
      }
      
      const pageSectionsPref = data?.[0];
      const sections = pageSectionsPref ? pageSectionsPref.value : ['next', 'activity', 'calendar', 'statics', 'diary'];
      
      return { sections };
    } catch (error) {
      console.warn('[getLayout] Failed to load layout:', error);
      // エラーの場合はデフォルトレイアウトを返す
      return { sections: ['next', 'activity', 'calendar', 'statics', 'diary'] };
    }
  }
}

export async function saveLayout(sections: any[]) { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/layout', { method: 'POST', body: JSON.stringify({ sections }) });
  } else {
    // Supabaseクライアント直接使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('preferences')
      .upsert({
        key: 'pageSections',
        value: sections,
        owner_type: 'user',
        owner_id: user.id,
      });
    
    if (error) throw new Error(error.message);
    return { sections };
  }
}

// Diary API functions
export async function getDiaryCards(options?: { query?: string }) {
  if (USE_EDGE_FUNCTIONS) {
    const queryParam = options?.query ? `?search=${encodeURIComponent(options.query)}` : '';
    return await request(`/diary/cards${queryParam}`);
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data, error } = await supabase
        .from('diary_cards')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[getDiaryCards] Database error:', error.message);
        throw new Error(error.message);
      }
      
      console.log('[getDiaryCards] Successfully loaded', data?.length || 0, 'diary cards');
      
      // Transform snake_case to camelCase for frontend compatibility
      const transformedData = (data || []).map((card: any) => ({
        ...card,
        frontMd: card.front_md,
        backMd: card.back_md,
        createdAt: card.created_at,
        updatedAt: card.updated_at,
      }));
      
      return transformedData;
    } catch (error) {
      console.error('[getDiaryCards] Failed to load diary cards:', error);
      throw error;
    }
  }
}

export async function createDiaryCard(payload: {
  frontMd: string;
  backMd: string;
  tagIds?: string[];
  goalIds?: string[];
  habitIds?: string[];
}) {
  if (USE_EDGE_FUNCTIONS) {
    return await request('/diary/cards', { method: 'POST', body: JSON.stringify(payload) });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const cardData = {
      front_md: payload.frontMd || '',
      back_md: payload.backMd || '',
      owner_type: 'user',
      owner_id: user.id,
    };
    
    console.log('[createDiaryCard] Creating diary card with data:', cardData);
    
    const { data, error } = await supabase
      .from('diary_cards')
      .insert(cardData)
      .select()
      .single();
    
    if (error) {
      console.error('[createDiaryCard] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[createDiaryCard] Successfully created diary card:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      frontMd: data.front_md,
      backMd: data.back_md,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return transformedData;
  }
}

export async function updateDiaryCard(id: string, payload: {
  frontMd?: string;
  backMd?: string;
  tagIds?: string[];
  goalIds?: string[];
  habitIds?: string[];
}) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/diary/cards/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const updateData: any = {};
    if (payload.frontMd !== undefined) updateData.front_md = payload.frontMd;
    if (payload.backMd !== undefined) updateData.back_md = payload.backMd;
    
    console.log('[updateDiaryCard] Updating diary card', id, 'with data:', updateData);
    
    const { data, error } = await supabase
      .from('diary_cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('[updateDiaryCard] Database error:', error.message);
      throw new Error(error.message);
    }
    
    console.log('[updateDiaryCard] Successfully updated diary card:', data);
    
    // Transform response to camelCase
    const transformedData = {
      ...data,
      frontMd: data.front_md,
      backMd: data.back_md,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
    
    return transformedData;
  }
}

export async function deleteDiaryCard(id: string) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/diary/cards/${id}`, { method: 'DELETE' });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('diary_cards')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

export async function getDiaryTags() {
  if (USE_EDGE_FUNCTIONS) {
    return await request('/diary/tags');
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    try {
      const { data, error } = await supabase
        .from('diary_tags')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        console.error('[getDiaryTags] Database error:', error.message);
        throw new Error(error.message);
      }
      
      console.log('[getDiaryTags] Successfully loaded', data?.length || 0, 'diary tags');
      return data || [];
    } catch (error) {
      console.error('[getDiaryTags] Failed to load diary tags:', error);
      throw error;
    }
  }
}

export async function createDiaryTag(payload: any) {
  if (USE_EDGE_FUNCTIONS) {
    return await request('/diary/tags', { method: 'POST', body: JSON.stringify(payload) });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    
    const tagData = {
      name: payload.name,
      color: payload.color,
      owner_type: 'user',
      owner_id: user.id,
    };
    
    const { data, error } = await supabase
      .from('diary_tags')
      .insert(tagData)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function updateDiaryTag(id: string, payload: any) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/diary/tags/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const updateData: any = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.color !== undefined) updateData.color = payload.color;
    
    const { data, error } = await supabase
      .from('diary_tags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function deleteDiaryTag(id: string) {
  if (USE_EDGE_FUNCTIONS) {
    return await request(`/diary/tags/${id}`, { method: 'DELETE' });
  } else {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase
      .from('diary_tags')
      .delete()
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

// 互換性のための関数（Supabase統合版では不要）
export async function claim() { 
  // Supabase統合版では不要（自動的にユーザーIDでデータが分離される）
  return { success: true };
}

// 互換性のための関数（Supabase統合版では不要）
export function setBearerToken(token: string | null) {
  // Supabase統合版では不要（自動的にセッション管理される）
  console.log('setBearerToken called but not needed in Supabase integrated version');
}

// 旧システムとの互換性のためのdefault export
const api = {
  setBearerToken,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  getDiaryCards,
  createDiaryCard,
  updateDiaryCard,
  deleteDiaryCard,
  getDiaryTags,
  createDiaryTag,
  updateDiaryTag,
  deleteDiaryTag,
  me,
  getLayout,
  saveLayout,
  claim,
  // 旧システム互換性のための追加関数
  login: async (credentials: any) => {
    // Supabase統合版では直接Supabase Authを使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw new Error(error.message);
    return { success: true };
  },
  register: async (userData: any) => {
    // Supabase統合版では直接Supabase Authを使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name
        }
      }
    });
    if (error) throw new Error(error.message);
    return { success: true };
  },
  logout: async () => {
    // Supabase統合版では直接Supabase Authを使用
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return { success: true };
  }
};

export default api;