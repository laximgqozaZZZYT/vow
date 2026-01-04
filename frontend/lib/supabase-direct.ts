import { supabase } from './supabaseClient';

// Supabase direct client for production use
export class SupabaseDirectClient {
  async getGoals() {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      // Return empty array for guest users
      return [];
    }
    
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', session.session.user.id)
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createGoal(payload: { name: string; details?: string; dueDate?: string; parentId?: string | null }) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('goals')
      .insert({
        ...payload,
        user_id: session.session.user.id,
        isCompleted: false,
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateGoal(id: string, payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('goals')
      .update({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteGoal(id: string) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('user_id', session.session.user.id);
    
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
      .eq('user_id', session.session.user.id)
      .order('createdAt', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createHabit(payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('habits')
      .insert({
        ...payload,
        user_id: session.session.user.id,
        active: true,
        count: 0,
        completed: false,
        createdAt: now,
        updatedAt: now
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async updateHabit(id: string, payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('habits')
      .update({
        ...payload,
        updatedAt: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', session.session.user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  async deleteHabit(id: string) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('habits')
      .delete()
      .eq('id', id)
      .eq('user_id', session.session.user.id);
    
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
      .eq('user_id', session.session.user.id)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async createActivity(payload: any) {
    if (!supabase) throw new Error('Supabase not configured');
    
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .from('activities')
      .insert({
        ...payload,
        user_id: session.session.user.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
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
}

export const supabaseDirectClient = new SupabaseDirectClient();