"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function TestAuthPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      setSession(session);
      
      const results = [];
      
      // 1. Supabase接続テスト
      results.push({
        test: 'Supabase接続',
        status: error ? 'エラー' : '成功',
        details: error ? error.message : 'クライアント初期化成功'
      });

      // 2. セッション状態
      results.push({
        test: 'セッション状態',
        status: session ? '認証済み' : '未認証',
        details: session ? `ユーザー: ${session.user.email}` : 'ログインが必要'
      });

      // 3. データベース接続テスト
      try {
        const { data, error: dbError } = await supabase
          .from('goals')
          .select('count')
          .limit(1);
        
        results.push({
          test: 'データベース接続',
          status: dbError ? 'エラー' : '成功',
          details: dbError ? dbError.message : 'テーブルアクセス成功'
        });
      } catch (dbErr: any) {
        results.push({
          test: 'データベース接続',
          status: 'エラー',
          details: dbErr.message
        });
      }

      setTestResults(results);
    } catch (err: any) {
      setTestResults([{
        test: '全体テスト',
        status: 'エラー',
        details: err.message
      }]);
    } finally {
      setLoading(false);
    }
  }

  async function testGoogleAuth() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      
      if (error) {
        alert(`Google認証エラー: ${error.message}`);
      } else {
        console.log('Google認証URL生成成功:', data.url);
      }
    } catch (err: any) {
      alert(`Google認証テストエラー: ${err.message}`);
    }
  }

  async function testGitHubAuth() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      
      if (error) {
        alert(`GitHub認証エラー: ${error.message}`);
      } else {
        console.log('GitHub認証URL生成成功:', data.url);
      }
    } catch (err: any) {
      alert(`GitHub認証テストエラー: ${err.message}`);
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert(`ログアウトエラー: ${error.message}`);
      } else {
        setSession(null);
        checkAuth(); // 再テスト
      }
    } catch (err: any) {
      alert(`ログアウトエラー: ${err.message}`);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">認証設定をテスト中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">🔧 Supabase認証設定テスト</h1>
          
          {/* 環境情報 */}
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <h2 className="font-semibold mb-2">📊 環境情報</h2>
            <div className="text-sm space-y-1">
              <div><strong>現在のURL:</strong> {window.location.origin}</div>
              <div><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</div>
              <div><strong>環境:</strong> {process.env.NODE_ENV || 'development'}</div>
            </div>
          </div>

          {/* テスト結果 */}
          <div className="mb-6">
            <h2 className="font-semibold mb-4">🧪 テスト結果</h2>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className={`p-3 rounded border-l-4 ${
                  result.status === '成功' ? 'bg-green-50 border-green-400' :
                  result.status === '認証済み' ? 'bg-blue-50 border-blue-400' :
                  result.status === '未認証' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-red-50 border-red-400'
                }`}>
                  <div className="font-medium">{result.test}: {result.status}</div>
                  <div className="text-sm text-gray-600">{result.details}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 認証テストボタン */}
          <div className="mb-6">
            <h2 className="font-semibold mb-4">🔐 OAuth認証テスト</h2>
            <div className="space-x-4">
              <button
                onClick={testGoogleAuth}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Google認証テスト
              </button>
              <button
                onClick={testGitHubAuth}
                className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
              >
                GitHub認証テスト
              </button>
              {session && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  ログアウト
                </button>
              )}
            </div>
          </div>

          {/* セッション情報 */}
          {session && (
            <div className="mb-6 p-4 bg-green-50 rounded">
              <h2 className="font-semibold mb-2">👤 現在のセッション</h2>
              <div className="text-sm space-y-1">
                <div><strong>ユーザーID:</strong> {session.user.id}</div>
                <div><strong>メール:</strong> {session.user.email}</div>
                <div><strong>プロバイダー:</strong> {session.user.app_metadata?.provider}</div>
                <div><strong>認証時刻:</strong> {new Date(session.user.created_at).toLocaleString()}</div>
              </div>
            </div>
          )}

          {/* 設定確認項目 */}
          <div className="p-4 bg-gray-50 rounded">
            <h2 className="font-semibold mb-2">📋 設定確認項目</h2>
            <div className="text-sm space-y-2">
              <div><strong>1. Supabase Dashboard → Authentication → Settings</strong></div>
              <div className="ml-4">
                <div>• Site URL: https://jamiyzsyclvlvstmeeir.supabase.co</div>
                <div>• Additional Redirect URLs: {window.location.origin}</div>
                <div>• Additional Redirect URLs: {window.location.origin}/dashboard</div>
              </div>
              
              <div><strong>2. Google Cloud Console → Credentials</strong></div>
              <div className="ml-4">
                <div>• Authorized JavaScript origins: {window.location.origin}</div>
                <div>• Authorized redirect URIs: https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback</div>
              </div>
              
              <div><strong>3. GitHub OAuth App → Settings</strong></div>
              <div className="ml-4">
                <div>• Authorization callback URL: https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback</div>
              </div>
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="mt-6 pt-4 border-t">
            <div className="space-x-4">
              <a href="/login" className="text-blue-600 hover:underline">ログインページ</a>
              <a href="/dashboard" className="text-blue-600 hover:underline">ダッシュボード</a>
              <a href="/" className="text-blue-600 hover:underline">ホーム</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}