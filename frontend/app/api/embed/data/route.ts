import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// セキュリティ設定
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://vow-dashboard.vercel.app', // 本番環境のドメインを追加
];

const MAX_ITEMS_PER_TYPE = 5; // データ量制限
const CACHE_DURATION = 300; // 5分キャッシュ

// CORS ヘッダー設定
function setCorsHeaders(response: NextResponse, origin?: string) {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Cache-Control', `public, max-age=${CACHE_DURATION}`);
  return response;
}

// OPTIONS リクエスト処理
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 200 });
  return setCorsHeaders(response, origin || undefined);
}

// 安全なデータフィルタリング
function sanitizeData(data: any[], type: string) {
  return data.slice(0, MAX_ITEMS_PER_TYPE).map(item => {
    switch (type) {
      case 'habits':
        return {
          id: item.id,
          name: item.name || 'Unnamed Habit',
          status: item.status || 'pending',
          progress: Math.min(Math.max(item.progress || 0, 0), 100), // 0-100に制限
          nextScheduled: item.next_scheduled || new Date().toISOString(),
          category: item.category || 'general',
        };
      case 'activities':
        return {
          id: item.id,
          title: item.title || 'Activity',
          start: item.start_time || new Date().toISOString(),
          end: item.end_time,
          type: item.type || 'custom',
          status: item.status || 'pending',
        };
      case 'goals':
        return {
          id: item.id,
          title: item.title || 'Goal',
          progress: Math.min(Math.max(item.progress || 0, 0), 100),
          status: item.status || 'active',
          category: item.category || 'personal',
        };
      default:
        return {
          id: item.id,
          title: item.title || item.name || 'Item',
          status: item.status || 'unknown',
        };
    }
  });
}

// 統計データの生成
function generateStatistics(habits: any[], activities: any[], goals: any[]) {
  const today = new Date().toDateString();
  const todayActivities = activities.filter(a => 
    new Date(a.start).toDateString() === today
  );
  
  const completedHabits = habits.filter(h => h.status === 'completed').length;
  const totalHabits = habits.length;
  
  return {
    todayProgress: totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0,
    weeklyProgress: Math.floor(Math.random() * 30) + 70, // 模擬データ
    streakCount: Math.floor(Math.random() * 20) + 5,
    completionRate: totalHabits > 0 ? Math.round((completedHabits / totalHabits) * 100) : 0,
    todayActivities: todayActivities.length,
    activeGoals: goals.filter(g => g.status === 'active').length,
  };
}

// ヒートマップデータの生成（過去30日）
function generateHeatmapData(activities: any[]) {
  const heatmapData = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayActivities = activities.filter(a => 
      new Date(a.start).toISOString().split('T')[0] === dateStr
    );
    
    heatmapData.push({
      date: dateStr,
      count: dayActivities.length,
      intensity: Math.min(dayActivities.length / 5, 1), // 0-1の強度
    });
  }
  
  return heatmapData;
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    // 認証トークンの確認
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
      return setCorsHeaders(response, origin || undefined);
    }

    const token = authHeader.substring(7);
    
    // Supabase クライアント初期化
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // トークンでユーザー認証
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      const response = NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
      return setCorsHeaders(response, origin || undefined);
    }

    // データ取得（読み取り専用）
    const [habitsResult, activitiesResult, goalsResult] = await Promise.all([
      supabase
        .from('habits')
        .select('id, name, status, progress, next_scheduled, category')
        .eq('user_id', user.id)
        .limit(MAX_ITEMS_PER_TYPE),
      
      supabase
        .from('activities')
        .select('id, title, start_time, end_time, type, status')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(MAX_ITEMS_PER_TYPE * 2), // ヒートマップ用に多めに取得
      
      supabase
        .from('goals')
        .select('id, title, progress, status, category')
        .eq('user_id', user.id)
        .limit(MAX_ITEMS_PER_TYPE),
    ]);

    // エラーハンドリング
    if (habitsResult.error || activitiesResult.error || goalsResult.error) {
      throw new Error('Database query failed');
    }

    // データのサニタイズ
    const habits = sanitizeData(habitsResult.data || [], 'habits');
    const activities = sanitizeData(activitiesResult.data || [], 'activities');
    const goals = sanitizeData(goalsResult.data || [], 'goals');

    // 統計とヒートマップデータの生成
    const statistics = generateStatistics(habits, activities, goals);
    const heatmapData = generateHeatmapData(activitiesResult.data || []);

    // レスポンスデータ
    const responseData = {
      user: {
        id: user.id,
        // 個人情報は含めない
      },
      data: {
        habits,
        activities: activities.slice(0, MAX_ITEMS_PER_TYPE), // 表示用は制限
        goals,
        statistics,
        heatmap: heatmapData,
      },
      meta: {
        timestamp: new Date().toISOString(),
        cached: false,
        dataLimited: true, // データが制限されていることを明示
      },
    };

    const response = NextResponse.json(responseData);
    return setCorsHeaders(response, origin || undefined);

  } catch (error) {
    console.error('Embed API error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
    return setCorsHeaders(response, origin || undefined);
  }
}