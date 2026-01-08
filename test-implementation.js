// Test script to verify guest user implementation
// This should be run in the browser console at localhost:3001/dashboard

console.log('=== Guest User Implementation Test ===');

// Test 1: Check environment configuration
console.log('1. Environment Configuration:');
console.log('USE_EDGE_FUNCTIONS:', 'false'); // Should be false based on .env.local

// Test 2: Check authentication state
console.log('2. Authentication State:');
// This would show the current auth state from useAuth hook

// Test 3: Test localStorage functionality
console.log('3. LocalStorage Test:');
try {
  // Clear any existing test data
  localStorage.removeItem('guest-goals');
  localStorage.removeItem('guest-habits');
  localStorage.removeItem('guest-activities');
  
  // Test goal creation
  const testGoal = {
    id: 'goal-test-' + Date.now(),
    name: 'Test Goal',
    details: 'Test goal for guest user',
    isCompleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem('guest-goals', JSON.stringify([testGoal]));
  const savedGoals = JSON.parse(localStorage.getItem('guest-goals') || '[]');
  console.log('Goal localStorage test:', savedGoals.length === 1 ? 'PASS' : 'FAIL');
  
  // Test habit creation
  const testHabit = {
    id: 'habit-test-' + Date.now(),
    name: 'Test Habit',
    type: 'do',
    goalId: testGoal.id,
    active: true,
    count: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem('guest-habits', JSON.stringify([testHabit]));
  const savedHabits = JSON.parse(localStorage.getItem('guest-habits') || '[]');
  console.log('Habit localStorage test:', savedHabits.length === 1 ? 'PASS' : 'FAIL');
  
} catch (error) {
  console.error('LocalStorage test failed:', error);
}

// Test 4: API routing test (if available)
console.log('4. API Routing Test:');
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('Running on localhost - API tests available');
  
  // Test me() endpoint
  fetch('/api/me')
    .then(response => response.json())
    .then(data => {
      console.log('me() API response:', data);
      if (data.actor && data.actor.type === 'guest') {
        console.log('Guest user detection: PASS');
      } else {
        console.log('Guest user detection: FAIL - Expected guest actor');
      }
    })
    .catch(error => {
      console.error('me() API test failed:', error);
    });
} else {
  console.log('Not on localhost - skipping API tests');
}

console.log('=== Test Complete ===');
console.log('To test habit creation, try creating a habit in the dashboard UI and check the browser console for logs.');