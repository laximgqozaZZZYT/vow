// 本番環境デバッグ用スクリプト
// ブラウザのコンソールで実行

console.log('=== Production Debug Script ===');

// 1. 環境変数確認
console.log('Environment Variables:');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_USE_SUPABASE_API:', process.env.NEXT_PUBLIC_USE_SUPABASE_API);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 2. Supabaseクライアント確認
if (window.supabase) {
  console.log('✅ Supabase client available');
  
  // 3. 認証状態確認
  window.supabase.auth.getSession().then(({ data: session, error }) => {
    if (error) {
      console.error('❌ Auth session error:', error);
    } else if (session?.session?.user) {
      console.log('✅ User authenticated:', session.session.user.email);
      console.log('User ID:', session.session.user.id);
      
      // 4. テーブル存在確認
      testTableAccess();
    } else {
      console.log('❌ User not authenticated');
    }
  });
} else {
  console.error('❌ Supabase client not available');
}

// テーブルアクセステスト
async function testTableAccess() {
  console.log('\n=== Table Access Test ===');
  
  try {
    // Goals テーブルテスト
    console.log('Testing goals table...');
    const { data: goals, error: goalsError } = await window.supabase
      .from('goals')
      .select('*')
      .limit(1);
    
    if (goalsError) {
      console.error('❌ Goals table error:', goalsError);
    } else {
      console.log('✅ Goals table accessible:', goals);
    }
    
    // Habits テーブルテスト
    console.log('Testing habits table...');
    const { data: habits, error: habitsError } = await window.supabase
      .from('habits')
      .select('*')
      .limit(1);
    
    if (habitsError) {
      console.error('❌ Habits table error:', habitsError);
    } else {
      console.log('✅ Habits table accessible:', habits);
    }
    
    // テスト用Goal作成
    console.log('Testing goal creation...');
    const { data: testGoal, error: createGoalError } = await window.supabase
      .from('goals')
      .insert({
        name: 'Test Goal ' + Date.now(),
        owner_type: 'user',
        owner_id: (await window.supabase.auth.getSession()).data.session.user.id
      })
      .select()
      .single();
    
    if (createGoalError) {
      console.error('❌ Goal creation error:', createGoalError);
    } else {
      console.log('✅ Goal created successfully:', testGoal);
      
      // テスト用Habit作成
      console.log('Testing habit creation...');
      const { data: testHabit, error: createHabitError } = await window.supabase
        .from('habits')
        .insert({
          goal_id: testGoal.id,
          name: 'Test Habit ' + Date.now(),
          type: 'do',
          owner_type: 'user',
          owner_id: (await window.supabase.auth.getSession()).data.session.user.id
        })
        .select()
        .single();
      
      if (createHabitError) {
        console.error('❌ Habit creation error:', createHabitError);
      } else {
        console.log('✅ Habit created successfully:', testHabit);
        
        // クリーンアップ
        await window.supabase.from('habits').delete().eq('id', testHabit.id);
        await window.supabase.from('goals').delete().eq('id', testGoal.id);
        console.log('✅ Test data cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

console.log('\n📋 Instructions:');
console.log('1. Copy this script');
console.log('2. Open browser console on production site');
console.log('3. Paste and run the script');
console.log('4. Check the output for errors');