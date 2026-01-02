const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')

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
      credentials: 'include',
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

export async function getGoals() { return await request('/goals') }
export async function getGoal(id: string) { return await request(`/goals/${id}`) }
export async function createGoal(payload: any) { return await request('/goals', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateGoal(id: string, payload: any) { return await request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function deleteGoal(id: string) { return await request(`/goals/${id}`, { method: 'DELETE' }) }

export async function getHabits() { return await request('/habits') }
export async function getHabit(id: string) { return await request(`/habits/${id}`) }
export async function createHabit(payload: any) { return await request('/habits', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateHabit(id: string, payload: any) { return await request(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function deleteHabit(id: string) { return await request(`/habits/${id}`, { method: 'DELETE' }) }

export async function getActivities() { return await request('/activities') }
export async function createActivity(payload: any) { return await request('/activities', { method: 'POST', body: JSON.stringify(payload) }) }
export async function updateActivity(id: string, payload: any) { return await request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export async function deleteActivity(id: string) { return await request(`/activities/${id}`, { method: 'DELETE' }) }

export async function getLayout() { return await request('/layout') }
export async function setLayout(sections: any[]) { return await request('/layout', { method: 'POST', body: JSON.stringify({ sections }) }) }

export async function getPrefs() { return await request('/prefs') }
export async function setPref(key: string, value: any) { return await request('/prefs', { method: 'POST', body: JSON.stringify({ key, value }) }) }

export async function me() { return await request('/me') }
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
  return await request('/diary/tags')
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
  const qs = new URLSearchParams()
  if (params.query) qs.set('query', params.query)
  for (const id of params.tag ?? []) qs.append('tag', id)
  for (const id of params.goal ?? []) qs.append('goal', id)
  for (const id of params.habit ?? []) qs.append('habit', id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return await request(`/diary${suffix}`)
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
