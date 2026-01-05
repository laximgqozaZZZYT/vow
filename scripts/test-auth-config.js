#!/usr/bin/env node

/**
 * Supabase認証設定テストスクリプト
 * ローカル開発環境と本番環境の両方でOAuth認証が動作するかテスト
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jamiyzsyclvlvstmeeir.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_YJyBL2tPoqCB6hWl-8qQ4Q_b3qYpcBm';

console.log('🔍 Supabase認証設定テスト');
console.log('================================');

// Supabaseクライアント作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testAuthConfig() {
  try {
    console.log('📡 Supabase接続テスト...');
    
    // 1. Supabase接続確認
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('❌ セッション取得エラー:', sessionError.message);
    } else {
      console.log('✅ Supabase接続成功');
      console.log('📊 現在のセッション:', session ? 'あり' : 'なし');
    }

    // 2. OAuth URL生成テスト
    console.log('\n🔐 OAuth URL生成テスト...');
    
    // Google OAuth URL
    const { data: googleData, error: googleError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${process.env.NODE_ENV === 'production' ? SUPABASE_URL : 'http://localhost:3000'}/dashboard`
      }
    });
    
    if (googleError) {
      console.error('❌ Google OAuth URL生成エラー:', googleError.message);
    } else {
      console.log('✅ Google OAuth URL生成成功');
      console.log('🔗 Google OAuth URL:', googleData.url);
    }

    // GitHub OAuth URL
    const { data: githubData, error: githubError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${process.env.NODE_ENV === 'production' ? SUPABASE_URL : 'http://localhost:3000'}/dashboard`
      }
    });
    
    if (githubError) {
      console.error('❌ GitHub OAuth URL生成エラー:', githubError.message);
    } else {
      console.log('✅ GitHub OAuth URL生成成功');
      console.log('🔗 GitHub OAuth URL:', githubData.url);
    }

    // 3. データベース接続テスト
    console.log('\n🗄️ データベース接続テスト...');
    
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('count')
      .limit(1);
    
    if (goalsError) {
      console.error('❌ データベース接続エラー:', goalsError.message);
    } else {
      console.log('✅ データベース接続成功');
    }

    console.log('\n📋 設定確認項目:');
    console.log('================================');
    console.log('1. Supabase Dashboard → Authentication → Settings');
    console.log('   Site URL: https://jamiyzsyclvlvstmeeir.supabase.co');
    console.log('   Additional Redirect URLs:');
    console.log('   - http://localhost:3000');
    console.log('   - http://localhost:3000/dashboard');
    console.log('   - https://jamiyzsyclvlvstmeeir.supabase.co/dashboard');
    console.log('');
    console.log('2. Google Cloud Console → Credentials');
    console.log('   Authorized JavaScript origins:');
    console.log('   - http://localhost:3000');
    console.log('   - https://jamiyzsyclvlvstmeeir.supabase.co');
    console.log('   Authorized redirect URIs:');
    console.log('   - https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback');
    console.log('');
    console.log('3. GitHub OAuth App → Settings');
    console.log('   Authorization callback URL:');
    console.log('   - https://jamiyzsyclvlvstmeeir.supabase.co/auth/v1/callback');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error.message);
  }
}

// 環境変数確認
console.log('🔧 環境変数確認:');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '設定済み' : '未設定');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');

// テスト実行
testAuthConfig().then(() => {
  console.log('\n✅ テスト完了');
}).catch((error) => {
  console.error('\n❌ テスト失敗:', error);
  process.exit(1);
});