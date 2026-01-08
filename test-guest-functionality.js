// Simple test script to verify guest user functionality
// Run this in the browser console at localhost:3001/dashboard

console.log('=== Testing Guest User Functionality ===');

// Test 1: Check authentication state
console.log('1. Checking authentication state...');
console.log('Current URL:', window.location.href);

// Test 2: Check if API is available
console.log('2. Checking API availability...');
if (typeof window !== 'undefined') {
  // Check if we can access the API
  fetch('/api/me')
    .then(response => response.json())
    .then(data => console.log('API /me response:', data))
    .catch(error => console.error('API /me error:', error));
}

// Test 3: Check localStorage for guest data
console.log('3. Checking localStorage for guest data...');
const guestGoals = localStorage.getItem('guest-goals');
const guestHabits = localStorage.getItem('guest-habits');
const guestActivities = localStorage.getItem('guest-activities');

console.log('Guest goals in localStorage:', guestGoals ? JSON.parse(guestGoals) : 'None');
console.log('Guest habits in localStorage:', guestHabits ? JSON.parse(guestHabits) : 'None');
console.log('Guest activities in localStorage:', guestActivities ? JSON.parse(guestActivities) : 'None');

// Test 4: Try creating a test habit
console.log('4. Testing habit creation...');
const testHabit = {
  name: 'Test Habit',
  type: 'do',
  goalId: 'test-goal'
};

// This would need to be run in the context where api is available
console.log('Test habit payload:', testHabit);
console.log('=== End Test ===');