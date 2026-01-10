// Supabase統合版API - バックエンドAPI直接使用

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

// 強制的にデバッグ情報を表示 - TIMESTAMP: 2026-01-09-14:30
console.log('=== FORCE DEBUG V3 - TIMESTAMP 2026-01-09-14:30 ===');
console.log('Raw NEXT_PUBLIC_USE_EDGE_FUNCTIONS:', process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS);
console.log('Parsed USE_EDGE_FUNCTIONS:', USE_EDGE_FUNCTIONS);
console.log('Type of USE_EDGE_FUNCTIONS:', typeof USE_EDGE_FUNCTIONS);
console.log('🔍 CACHE_CLEARED_V3 - TIMESTAMP 2026-01-09-14:30'); // キャッシュクリア確認用
console.log('=== END FORCE DEBUG ===');

// デバッグ用ログ
if (typeof window !== 'undefined') {
  console.log('=== API Configuration Debug (Supabase Integrated) ===');
  console.log('SUPABASE_URL:', SUPABASE_URL);
  console.log('USE_EDGE_FUNCTIONS:', USE_EDGE_FUNCTIONS);
  
  const apiChoice = USE_EDGE_FUNCTIONS ? 'Supabase Edge Functions' : 'Supabase Client Direct';
  console.log('🚀 Using:', apiChoice);
  console.log('Environment variables check:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('- NEXT_PUBLIC_USE_EDGE_FUNCTIONS:', process.env.NEXT_PUBLIC_USE_EDGE_FUNCTIONS);
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
  console.log('=== REQUEST DEBUG ===');
  console.log('Path:', path);
  console.log('Method:', opts.method || 'GET');
  console.log('USE_EDGE_FUNCTIONS:', USE_EDGE_FUNCTIONS);
  console.log('Will use:', USE_EDGE_FUNCTIONS ? 'Edge Functions' : 'Direct Client');
  console.log('=== END REQUEST DEBUG ===');
  
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
    const { supabaseDirectClient } = await import('./supabase-direct');
    
    // パスに基づいてSupabaseクライアントメソッドを呼び出し
    if (path === '/goals') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createGoal(payload);
      }
      return await supabaseDirectClient.getGoals();
    } else if (path.startsWith('/goals/')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateGoal(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteGoal(id);
      }
    } else if (path === '/habits') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createHabit(payload);
      }
      return await supabaseDirectClient.getHabits();
    } else if (path.startsWith('/habits/')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateHabit(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteHabit(id);
      }
    } else if (path === '/activities') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createActivity(payload);
      }
      return await supabaseDirectClient.getActivities();
    } else if (path.startsWith('/activities/')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateActivity(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteActivity(id);
      }
    } else if (path === '/me') {
      return await supabaseDirectClient.me();
    } else if (path === '/layout') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.setLayout(payload.sections);
      }
      return await supabaseDirectClient.getLayout();
    } else if (path === '/clear-guest-data') {
      if (opts.method === 'POST') {
        return await supabaseDirectClient.clearGuestData();
      }
    } else if (path === '/mindmaps') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createMindmap(payload);
      }
      return await supabaseDirectClient.getMindmaps();
    } else if (path.startsWith('/mindmaps/') && path.includes('/nodes')) {
      const mindmapId = path.split('/')[2];
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createMindmapNode(mindmapId, payload);
      }
      return await supabaseDirectClient.getMindmapNodes(mindmapId);
    } else if (path.startsWith('/mindmaps/') && path.includes('/connections')) {
      const mindmapId = path.split('/')[2];
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createMindmapConnection(mindmapId, payload);
      }
      return await supabaseDirectClient.getMindmapConnections(mindmapId);
    } else if (path.startsWith('/mindmaps/') && !path.includes('/nodes') && !path.includes('/connections')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateMindmap(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteMindmap(id);
      }
    } else if (path.startsWith('/mindmap-nodes/')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateMindmapNode(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteMindmapNode(id);
      }
    } else if (path.startsWith('/mindmap-connections/')) {
      const id = path.split('/')[2];
      if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteMindmapConnection(id);
      }
    } else if (path === '/diary') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createDiaryCard(payload);
      }
      return await supabaseDirectClient.getDiaryCards();
    } else if (path.startsWith('/diary/') && !path.includes('/tags')) {
      const id = path.split('/')[2];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateDiaryCard(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteDiaryCard(id);
      }
    } else if (path === '/diary/tags') {
      if (opts.method === 'POST') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.createDiaryTag(payload);
      }
      return await supabaseDirectClient.getDiaryTags();
    } else if (path.startsWith('/diary/tags/')) {
      const id = path.split('/')[3];
      if (opts.method === 'PATCH') {
        const payload = JSON.parse(opts.body as string);
        return await supabaseDirectClient.updateDiaryTag(id, payload);
      } else if (opts.method === 'DELETE') {
        return await supabaseDirectClient.deleteDiaryTag(id);
      }
    }
    
    throw new ApiError('Endpoint not implemented for direct Supabase client', path);
  }
}

// Goals API - 実際のスキーマに基づく実装
export async function getGoals() { 
  return await request('/goals');
}

export async function createGoal(payload: any) { 
  return await request('/goals', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateGoal(id: string, payload: any) { 
  return await request(`/goals/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteGoal(id: string) {
  return await request(`/goals/${id}`, { method: 'DELETE' });
}

// Habits API
export async function getHabits() { 
  return await request('/habits');
}

export async function createHabit(payload: any) { 
  return await request('/habits', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateHabit(id: string, payload: any) { 
  return await request(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteHabit(id: string) {
  return await request(`/habits/${id}`, { method: 'DELETE' });
}

// Activities API
export async function getActivities() { 
  return await request('/activities');
}

export async function createActivity(payload: any) { 
  return await request('/activities', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateActivity(id: string, payload: any) { 
  return await request(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteActivity(id: string) {
  return await request(`/activities/${id}`, { method: 'DELETE' });
}

// Layout API
export async function getLayout() { 
  return await request('/layout');
}

export async function saveLayout(sections: string[]) { 
  return await request('/layout', { method: 'POST', body: JSON.stringify({ sections }) });
}

// Clear guest data API
export async function clearGuestData() {
  return await request('/clear-guest-data', { method: 'POST' });
}

// Diary API
export async function getDiaryCards() {
  return await request('/diary');
}

export async function createDiaryCard(payload: any) {
  return await request('/diary', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDiaryCard(id: string, payload: any) {
  return await request(`/diary/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteDiaryCard(id: string) {
  return await request(`/diary/${id}`, { method: 'DELETE' });
}

export async function getDiaryTags() {
  return await request('/diary/tags');
}

export async function createDiaryTag(payload: any) {
  return await request('/diary/tags', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateDiaryTag(id: string, payload: any) {
  return await request(`/diary/tags/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteDiaryTag(id: string) {
  return await request(`/diary/tags/${id}`, { method: 'DELETE' });
}

// Mindmap API
export async function getMindmaps() {
  return await request('/mindmaps');
}

export async function createMindmap(payload: any) {
  return await request('/mindmaps', { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateMindmap(id: string, payload: any) {
  return await request(`/mindmaps/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteMindmap(id: string) {
  return await request(`/mindmaps/${id}`, { method: 'DELETE' });
}

export async function getMindmapNodes(mindmapId: string) {
  return await request(`/mindmaps/${mindmapId}/nodes`);
}

export async function createMindmapNode(mindmapId: string, payload: any) {
  return await request(`/mindmaps/${mindmapId}/nodes`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateMindmapNode(id: string, payload: any) {
  return await request(`/mindmap-nodes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function deleteMindmapNode(id: string) {
  return await request(`/mindmap-nodes/${id}`, { method: 'DELETE' });
}

export async function getMindmapConnections(mindmapId: string) {
  return await request(`/mindmaps/${mindmapId}/connections`);
}

export async function createMindmapConnection(mindmapId: string, payload: any) {
  return await request(`/mindmaps/${mindmapId}/connections`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function deleteMindmapConnection(id: string) {
  return await request(`/mindmap-connections/${id}`, { method: 'DELETE' });
}

// Auth API
export async function me() { 
  if (USE_EDGE_FUNCTIONS) {
    return await request('/me');
  } else {
    // Supabaseクライアント直接使用
    const { supabaseDirectClient } = await import('./supabase-direct');
    return await supabaseDirectClient.me();
  }
}

export async function claim() { 
  return await request('/auth/claim', { method: 'POST' });
}

// 認証関数
const api = {
  // データAPI
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
  saveLayout,
  clearGuestData,
  getDiaryCards,
  createDiaryCard,
  updateDiaryCard,
  deleteDiaryCard,
  getDiaryTags,
  createDiaryTag,
  updateDiaryTag,
  deleteDiaryTag,
  getMindmaps,
  createMindmap,
  updateMindmap,
  deleteMindmap,
  getMindmapNodes,
  createMindmapNode,
  updateMindmapNode,
  deleteMindmapNode,
  getMindmapConnections,
  createMindmapConnection,
  deleteMindmapConnection,
  me,
  claim,
  
  logout: async () => {
    const { supabase } = await import('./supabaseClient');
    if (!supabase) throw new Error('Supabase client not available');
    
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return { success: true };
  }
};

export default api;