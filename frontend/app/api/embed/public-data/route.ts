import { NextRequest, NextResponse } from 'next/server';

/**
 * 公開データAPI - 認証不要でデモデータを提供
 * セキュリティ: 読み取り専用、制限されたデモデータのみ
 */

export interface PublicEmbedData {
  habits: Array<{
    id: string;
    name: string;
    status: 'pending' | 'active' | 'completed';
    progress: number;
    nextScheduled: string;
    category: string;
  }>;
  activities: Array<{
    id: string;
    title: string;
    start: string;
    end?: string;
    type: 'habit' | 'goal' | 'custom';
    status: string;
  }>;
  goals: Array<{
    id: string;
    title: string;
    progress: number;
    status: 'active' | 'completed' | 'paused';
    category: string;
  }>;
  statistics: {
    todayProgress: number;
    weeklyProgress: number;
    streakCount: number;
    completionRate: number;
    todayActivities: number;
    activeGoals: number;
  };
  heatmap: Array<{
    date: string;
    count: number;
    intensity: number;
  }>;
}

// レート制限用のメモリストア（本番環境ではRedisなどを使用）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分
  const maxRequests = 30; // 1分間に30リクエスト

  const current = rateLimitStore.get(ip);
  
  if (!current || now > current.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}

function generateDemoData(): PublicEmbedData {
  const now = new Date();
  
  return {
    habits: [
      {
        id: 'demo-habit-1',
        name: 'Morning Exercise',
        status: 'completed',
        progress: 100,
        nextScheduled: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        category: 'Health',
      },
      {
        id: 'demo-habit-2',
        name: 'Read 30 minutes',
        status: 'active',
        progress: 60,
        nextScheduled: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        category: 'Learning',
      },
      {
        id: 'demo-habit-3',
        name: 'Meditation',
        status: 'pending',
        progress: 0,
        nextScheduled: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        category: 'Wellness',
      },
      {
        id: 'demo-habit-4',
        name: 'Write Journal',
        status: 'active',
        progress: 75,
        nextScheduled: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        category: 'Personal',
      },
    ],
    activities: [
      {
        id: 'demo-activity-1',
        title: 'Team Meeting',
        start: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        type: 'custom',
        status: 'scheduled',
      },
      {
        id: 'demo-activity-2',
        title: 'Code Review',
        start: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        type: 'custom',
        status: 'scheduled',
      },
      {
        id: 'demo-activity-3',
        title: 'Workout Session',
        start: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
        type: 'habit',
        status: 'completed',
      },
    ],
    goals: [
      {
        id: 'demo-goal-1',
        title: 'Learn TypeScript',
        progress: 75,
        status: 'active',
        category: 'Professional',
      },
      {
        id: 'demo-goal-2',
        title: 'Run 5K',
        progress: 40,
        status: 'active',
        category: 'Fitness',
      },
      {
        id: 'demo-goal-3',
        title: 'Read 12 Books',
        progress: 58,
        status: 'active',
        category: 'Learning',
      },
    ],
    statistics: {
      todayProgress: 67,
      weeklyProgress: 82,
      streakCount: 12,
      completionRate: 78,
      todayActivities: 4,
      activeGoals: 3,
    },
    heatmap: generateDemoHeatmap(),
  };
}

function generateDemoHeatmap() {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const count = Math.floor(Math.random() * 8);
    data.push({
      date: dateStr,
      count,
      intensity: Math.min(count / 6, 1),
    });
  }
  
  return data;
}

export async function GET(request: NextRequest) {
  try {
    // レート制限チェック
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // デモデータを生成
    const demoData = generateDemoData();

    // レスポンスヘッダーを設定
    const response = NextResponse.json({
      success: true,
      data: demoData,
      meta: {
        timestamp: new Date().toISOString(),
        type: 'demo',
        authenticated: false,
        dataLimited: true,
        message: 'Demo data - no authentication required',
      },
    });

    // セキュリティヘッダーを追加
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Cache-Control', 'public, max-age=300'); // 5分キャッシュ
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'ALLOWALL');

    return response;

  } catch (error) {
    console.error('Public data API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to generate demo data'
      },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        }
      }
    );
  }
}

// OPTIONS リクエストの処理（CORS プリフライト）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}