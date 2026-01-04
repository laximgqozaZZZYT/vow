// Vercel本番環境での環境変数とAPI設定を確認するスクリプト
// ブラウザのコンソールで実行してください

console.log('=== Vercel Production Environment Debug ===');

// 環境変数の確認
console.log('Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('NEXT_PUBLIC_USE_SUPABASE_API:', process.env.NEXT_PUBLIC_USE_SUPABASE_API);
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
console.log('NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);

// API設定の確認
const USE_SUPABASE_DIRECT = process.env.NEXT_PUBLIC_USE_SUPABASE_API === 'true';
const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

console.log('API Configuration:');
console.log('USE_SUPABASE_DIRECT:', USE_SUPABASE_DIRECT);
console.log('BASE_URL:', BASE_URL);

// どのAPIが使用されるかを表示
if (USE_SUPABASE_DIRECT) {
    console.log('✅ Supabase Direct API will be used');
} else {
    console.log('❌ Express API will be used (this causes the problem)');
}

// Supabaseクライアントの状態確認
if (typeof window !== 'undefined') {
    console.log('Window object available - client-side execution');
    
    // Supabaseクライアントが利用可能かチェック
    try {
        // グローバルにSupabaseクライアントがあるかチェック
        if (window.supabase || window.__SUPABASE_CLIENT__) {
            console.log('✅ Supabase client found in window');
        } else {
            console.log('❌ Supabase client not found in window');
        }
    } catch (e) {
        console.log('Error checking Supabase client:', e);
    }
} else {
    console.log('Server-side execution detected');
}

// 実際のAPI呼び出しをテスト
console.log('Testing API calls...');

// fetch APIでテスト
if (USE_SUPABASE_DIRECT) {
    console.log('Testing Supabase Direct API...');
    // Supabase Direct APIのテストは認証が必要なので、ログイン後に実行
} else {
    console.log('Testing Express API...');
    fetch(BASE_URL + '/goals')
        .then(response => {
            console.log('Express API Response Status:', response.status);
            return response.text();
        })
        .then(text => {
            console.log('Express API Response:', text);
        })
        .catch(error => {
            console.log('Express API Error:', error);
        });
}