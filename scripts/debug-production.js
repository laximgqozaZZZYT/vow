// Production Environment Debug Script
// Run this in browser console on production site

console.log('=== Production Environment Debug ===');

// Check environment variables
console.log('Environment Variables:');
console.log('NEXT_PUBLIC_USE_SUPABASE_API:', process.env.NEXT_PUBLIC_USE_SUPABASE_API);
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

// Check if Supabase client is available
if (typeof window !== 'undefined') {
  try {
    // Try to access Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    console.log('Supabase client created successfully');
    
    // Check authentication status
    supabase.auth.getSession().then(({ data: session, error }) => {
      if (error) {
        console.error('Auth session error:', error);
      } else {
        console.log('Auth session:', session?.session?.user ? 'AUTHENTICATED' : 'NOT AUTHENTICATED');
        if (session?.session?.user) {
          console.log('User ID:', session.session.user.id);
          console.log('User Email:', session.session.user.email);
        }
      }
    });
    
    // Test database connection
    supabase.from('goals').select('count').then(({ data, error }) => {
      if (error) {
        console.error('Database connection error:', error);
      } else {
        console.log('Database connection: SUCCESS');
      }
    });
    
  } catch (err) {
    console.error('Supabase setup error:', err);
  }
}

// Check API configuration
console.log('API Configuration:');
console.log('USE_SUPABASE_DIRECT:', process.env.NEXT_PUBLIC_USE_SUPABASE_API === 'true');
console.log('BASE API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000');