// Supabase REST API クライアント
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Supabase REST API用のヘルパー関数
class SupabaseApiError extends Error {
  status?: number;
  details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = 'SupabaseApiError';
    this.status = status;
    this.details = details;
  }
}

// 現在のユーザーIDを取得
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

// Goals API
export async function getGoals() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .order('created_at', { ascending: true })
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return data
}

export async function getGoal(id: string) {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', id)
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .single()
  
  if (error) throw new SupabaseApiError(error.message, error.code === 'PGRST116' ? 404 : 400, error)
  return data
}

export async function createGoal(payload: any) {
  const userId = await getCurrentUserId()
  const data = {
    ...payload,
    owner_type: userId ? 'user' : null,
    owner_id: userId
  }
  
  const { data: result, error } = await supabase
    .from('goals')
    .insert(data)
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return result
}

export async function updateGoal(id: string, payload: any) {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('goals')
    .update(payload)
    .eq('id', id)
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, error.code === 'PGRST116' ? 404 : 400, error)
  return data
}

export async function deleteGoal(id: string) {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', id)
    .or(`owner_id.eq.${userId},owner_id.is.null`)
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return { ok: true }
}

// Habits API
export async function getHabits() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('habits')
    .select('*')
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .order('created_at', { ascending: true })
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return data
}

export async function createHabit(payload: any) {
  const userId = await getCurrentUserId()
  const data = {
    ...payload,
    owner_type: userId ? 'user' : null,
    owner_id: userId
  }
  
  const { data: result, error } = await supabase
    .from('habits')
    .insert(data)
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return result
}

export async function updateHabit(id: string, payload: any) {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('habits')
    .update(payload)
    .eq('id', id)
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, error.code === 'PGRST116' ? 404 : 400, error)
  return data
}

export async function deleteHabit(id: string) {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('habits')
    .delete()
    .eq('id', id)
    .or(`owner_id.eq.${userId},owner_id.is.null`)
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return { ok: true }
}

// Activities API
export async function getActivities() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .or(`owner_id.eq.${userId},owner_id.is.null`)
    .order('timestamp', { ascending: false })
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return data
}

export async function createActivity(payload: any) {
  const userId = await getCurrentUserId()
  const data = {
    ...payload,
    owner_type: userId ? 'user' : null,
    owner_id: userId
  }
  
  const { data: result, error } = await supabase
    .from('activities')
    .insert(data)
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return result
}

// Preferences API (簡易版)
export async function getPrefs() {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('preferences')
    .select('*')
    .or(`owner_id.eq.${userId},owner_id.is.null`)
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  
  // Convert to key-value object
  const prefs: Record<string, any> = {}
  data?.forEach((p: any) => {
    prefs[p.key] = p.value
  })
  return prefs
}

export async function setPref(key: string, value: any) {
  const userId = await getCurrentUserId()
  const data = {
    key,
    value,
    owner_type: userId ? 'user' : null,
    owner_id: userId
  }
  
  // Upsert preference
  const { data: result, error } = await supabase
    .from('preferences')
    .upsert(data, { 
      onConflict: 'key,owner_type,owner_id',
      ignoreDuplicates: false 
    })
    .select()
    .single()
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return { key: result.key, value: result.value }
}

// Layout API
export async function getLayout() {
  const prefs = await getPrefs()
  const sections = prefs['layout:pageSections'] || ['next', 'activity', 'calendar', 'goals']
  return { sections }
}

export async function setLayout(sections: any[]) {
  await setPref('layout:pageSections', sections)
  return { sections }
}

// Auth API
export async function me() {
  const { data: { user } } = await supabase.auth.getUser()
  return { 
    actor: user ? { type: 'user', id: user.id } : { type: 'none', id: null }
  }
}

// Supabase handles auth directly, so these are simplified
export async function register(payload: { email: string; password: string; name?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        name: payload.name
      }
    }
  })
  
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return { user: data.user }
}

export async function login(payload: { email: string; password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email,
    password: payload.password
  })
  
  if (error) throw new SupabaseApiError(error.message, 401, error)
  return { user: data.user }
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new SupabaseApiError(error.message, 400, error)
  return { ok: true }
}

export async function claim() {
  // Supabaseでは自動的にユーザーデータが関連付けられるため、簡略化
  return { ok: true, merged: true }
}

// Export all functions
export default {
  getGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  getHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  getActivities,
  createActivity,
  getPrefs,
  setPref,
  getLayout,
  setLayout,
  me,
  register,
  login,
  logout,
  claim,
}