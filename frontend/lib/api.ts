const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '')

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
      headers: {
        'Content-Type': 'application/json',
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

export default { getGoals, createGoal, updateGoal, deleteGoal, getHabits, createHabit, updateHabit, deleteHabit, getActivities, createActivity, updateActivity, deleteActivity, getLayout, setLayout, getPrefs, setPref }
