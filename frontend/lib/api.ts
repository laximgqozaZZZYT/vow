import { supabaseDirectClient } from './supabase-direct';

// Next.js環境変数は実行時ではなくビルド時に解決される
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')
// 本番環境では強制的にSupabase Direct APIを使用
const USE_SUPABASE_DIRECT = process.env.NEXT_PUBLIC_USE_SUPABASE_API === 'true' || process.env.NODE_ENV === 'production'

// 強制的にSupabase Direct APIを使用（デバッグ用）
const FORCE_SUPABASE_DIRECT = true;

// デバッグ用ログ（本番環境で確認）
if (typeof window !== 'undefined') {
  console.log('=== API Configuration Debug ===');
  console.log('BASE:', BASE);
  console.log('USE_SUPABASE_DIRECT:', USE_SUPABASE_DIRECT);
  console.log('FORCE_SUPABASE_DIRECT:', FORCE_SUPABASE_DIRECT);
  console.log('NEXT_PUBLIC_USE_SUPABASE_API:', process.env.NEXT_PUBLIC_USE_SUPABASE_API);
  console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  const finalChoice = FORCE_SUPABASE_DIRECT || USE_SUPABASE_DIRECT;
  if (finalChoice) {
    console.log('✅ Using Supabase Direct API');
  } else {
    console.log('❌ Using Express API');
  }
}

let bearerToken: string | null = null

export function setBearerToken(token: string | null) {
  bearerToken = token
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

async function request(path: string, opts: RequestInit = {}) {
  const url = BASE + path;
  try {
    const res = await fetch(url, {
      ...opts,
      // credentials: 'include', // CORSエラーを回避するため削除
      headers: {
        'Content-Type': 'application/json',
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
        ...(opts.headers || {}),
      },
    });

    const text = await res.text();
    if (!res.ok) {
      // Surface status + body so we can see Prisma/coding errors from the backend.
      throw new ApiError(`HTTP ${res.status} ${res.statusText}`, url, { status: res.status, body: text });
    }

    return safeJsonParse(text);
  } catch (err: any) {
    // Network/CORS/DNS errors land here. Add URL context.
    if (err?.name === 'ApiError') throw err;
    const message = err?.message ? String(err.message) : String(err);
    throw new ApiError(`Failed to fetch (${message})`, url);
  }
}

// API functions with Supabase fallback
export async function getGoals() { 
  if (FORCE_SUPABASE_DIRECT || USE_SUPABASE_DIRECT) return await supabaseDirectClient.getGoals();
  return await request('/goals');
}

export async function createGoal(payload: any) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.createGoal(payload);
  return await request('/goals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateGoal(id: string, payload: any) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.updateGoal(id, payload);
  return await request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteGoal(id: string) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.deleteGoal(id);
  return await request(`/goals/${id}`, { method: 'DELETE' });
}

export async function getHabits() { 
  if (FORCE_SUPABASE_DIRECT || USE_SUPABASE_DIRECT) return await supabaseDirectClient.getHabits();
  return await request('/habits');
}

export async function createHabit(payload: any) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.createHabit(payload);
  return await request('/habits', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateHabit(id: string, payload: any) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.updateHabit(id, payload);
  return await request(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteHabit(id: string) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.deleteHabit(id);
  return await request(`/habits/${id}`, { method: 'DELETE' });
}

export async function getActivities() { 
  if (FORCE_SUPABASE_DIRECT || USE_SUPABASE_DIRECT) return await supabaseDirectClient.getActivities();
  return await request('/activities');
}

export async function createActivity(payload: any) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.createActivity(payload);
  return await request('/activities', { method: 'POST', body: JSON.stringify(payload) });
}

export async function me() { 
  if (FORCE_SUPABASE_DIRECT || USE_SUPABASE_DIRECT) return await supabaseDirectClient.me();
  return await request('/me');
}

export async function getLayout() { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.getLayout();
  return await request('/layout');
}

export async function setLayout(sections: any[]) { 
  if (USE_SUPABASE_DIRECT) return await supabaseDirectClient.setLayout(sections);
  return await request('/layout', { method: 'POST', body: JSON.stringify({ sections }) });
}

// Other functions remain unchanged for Express API compatibility
export async function getGoal(id: string) { return await request(`/goals/${id}`) }
export async function getHabit(id: string) { return await request(`/habits/${id}`) }
export async function updateActivity(id: string, payload: any) { return await request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function deleteActivity(id: string) { return await request(`/activities/${id}`, { method: 'DELETE' }) }
export async function getPrefs() { return await request('/prefs') }
export async function setPref(key: string, value: any) { return await request('/prefs', { method: 'POST', body: JSON.stringify({ key, value }) }) }
export async function register(payload: { email: string; password: string; name?: string }) { return await request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }) }
export async function login(payload: { email: string; password: string }) { return await request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }) }
export async function logout() { return await request('/auth/logout', { method: 'POST' }) }
export async function claim() { return await request('/auth/claim', { method: 'POST' }) }

// Diary
export type DiaryTag = {
  id: string
  name: string
  color?: string | null
  createdAt?: string
  updatedAt?: string
}

export type DiaryCard = {
  id: string
  frontMd: string
  backMd: string
  createdAt?: string
  updatedAt?: string
  tags?: DiaryTag[]
  goals?: Array<{ goalId: string; goal?: any }>
  habits?: Array<{ habitId: string; habit?: any }>
}

export async function getDiaryTags(): Promise<DiaryTag[]> {
  // 一時的に無効化 - Express APIを呼び出さないように
  return [];
  // return await request('/diary/tags')
}

export async function createDiaryTag(payload: { name: string; color?: string | null }): Promise<DiaryTag> {
  return await request('/diary/tags', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateDiaryTag(id: string, payload: { name?: string; color?: string | null }): Promise<DiaryTag> {
  return await request(`/diary/tags/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deleteDiaryTag(id: string): Promise<{ ok: true }> {
  return await request(`/diary/tags/${id}`, { method: 'DELETE' })
}

export async function getDiaryCards(params: {
  query?: string
  tag?: string[]
  goal?: string[]
  habit?: string[]
} = {}): Promise<DiaryCard[]> {
  // 一時的に無効化 - Express APIを呼び出さないように
  return [];
  // const qs = new URLSearchParams()
  // if (params.query) qs.set('query', params.query)
  // for (const id of params.tag ?? []) qs.append('tag', id)
  // for (const id of params.goal ?? []) qs.append('goal', id)
  // for (const id of params.habit ?? []) qs.append('habit', id)
  // const suffix = qs.toString() ? `?${qs.toString()}` : ''
  // return await request(`/diary${suffix}`)
}

export async function getDiaryCard(id: string): Promise<DiaryCard> {
  return await request(`/diary/${id}`)
}

export async function createDiaryCard(payload: {
  frontMd: string
  backMd?: string
  tagIds?: string[]
  goalIds?: string[]
  habitIds?: string[]
}): Promise<DiaryCard> {
  return await request('/diary', { method: 'POST', body: JSON.stringify(payload) })
}

export async function updateDiaryCard(
  id: string,
  payload: {
    frontMd?: string
    backMd?: string
    tagIds?: string[]
    goalIds?: string[]
    habitIds?: string[]
  }
): Promise<DiaryCard> {
  return await request(`/diary/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export async function deleteDiaryCard(id: string): Promise<{ ok: true }> {
  return await request(`/diary/${id}`, { method: 'DELETE' })
}

export default {
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
  getLayout,
  setLayout,
  getPrefs,
  setPref,
  me,
  register,
  login,
  logout,
  claim,
  // diary
  getDiaryTags,
  createDiaryTag,
  updateDiaryTag,
  deleteDiaryTag,
  getDiaryCards,
  getDiaryCard,
  createDiaryCard,
  updateDiaryCard,
  deleteDiaryCard,
  setBearerToken,
}
