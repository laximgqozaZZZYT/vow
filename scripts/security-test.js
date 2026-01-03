/*  */#!/usr/bin/env node

/**
 * セキュリティテストスクリプト
 * 認証システムの基本的なセキュリティチェックを実行
 */

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:4000';
const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

class SecurityTester {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, testFn) {
    console.log(`🧪 Testing: ${name}`);
    try {
      await testFn();
      this.results.push({ name, status: 'PASS' });
      this.passed++;
      console.log(`✅ PASS: ${name}`);
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      this.failed++;
      console.log(`❌ FAIL: ${name} - ${error.message}`);
    }
  }

  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https:');
      const client = isHttps ? https : http;
      
      const req = client.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  async runTests() {
    console.log('🔒 Starting Security Tests\n');

    // Test 1: X-User-Id header should be rejected
    await this.test('X-User-Id header rejection', async () => {
      const response = await this.makeRequest(`${API_BASE}/me`, {
        method: 'GET',
        headers: {
          'X-User-Id': 'test-user-id',
          'Content-Type': 'application/json'
        }
      });
      
      // Should not authenticate with X-User-Id anymore
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        if (body.actor && body.actor.type === 'user' && body.actor.id === 'test-user-id') {
          throw new Error('X-User-Id authentication still active');
        }
      }
    });

    // Test 2: Invalid Bearer token should be rejected
    await this.test('Invalid Bearer token rejection', async () => {
      const response = await this.makeRequest(`${API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });
      
      // Should not authenticate with invalid token
      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        if (body.actor && body.actor.type === 'user') {
          throw new Error('Invalid Bearer token was accepted');
        }
      }
    });

    // Test 3: CORS headers should be present
    await this.test('CORS headers validation', async () => {
      const response = await this.makeRequest(`${API_BASE}/me`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization'
        }
      });
      
      if (!response.headers['access-control-allow-origin']) {
        throw new Error('Missing CORS Allow-Origin header');
      }
      
      if (!response.headers['access-control-allow-credentials']) {
        throw new Error('Missing CORS Allow-Credentials header');
      }
    });

    // Test 4: Malicious CORS origin should be blocked
    await this.test('Malicious CORS origin blocking', async () => {
      const response = await this.makeRequest(`${API_BASE}/me`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://malicious-site.com',
          'Access-Control-Request-Method': 'GET'
        }
      });
      
      // Should either return error or not include the malicious origin
      if (response.headers['access-control-allow-origin'] === 'https://malicious-site.com') {
        throw new Error('Malicious CORS origin was allowed');
      }
    });

    // Test 5: SQL Injection attempt
    await this.test('SQL Injection protection', async () => {
      const maliciousPayload = {
        email: "admin@test.com'; DROP TABLE users; --",
        password: "password"
      };
      
      const response = await this.makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(maliciousPayload)
      });
      
      // Should handle malicious input gracefully
      if (response.statusCode === 500) {
        throw new Error('Server error on malicious input - possible SQL injection vulnerability');
      }
    });

    // Test 6: XSS attempt in registration
    await this.test('XSS protection in registration', async () => {
      const xssPayload = {
        email: "test@example.com",
        password: "password123",
        name: "<script>alert('xss')</script>"
      };
      
      const response = await this.makeRequest(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(xssPayload)
      });
      
      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = JSON.parse(response.body);
        if (body.user && body.user.name && body.user.name.includes('<script>')) {
          throw new Error('XSS payload was not sanitized');
        }
      }
    });

    // Test 7: Rate limiting (basic check)
    await this.test('Rate limiting check', async () => {
      const requests = [];
      for (let i = 0; i < 20; i++) {
        requests.push(
          this.makeRequest(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.statusCode === 429);
      
      // Note: This is optional - rate limiting might not be implemented yet
      console.log(`Rate limiting ${rateLimited ? 'detected' : 'not detected'} (optional)`);
    });

    // Test 8: HTTPS redirect (if applicable)
    if (API_BASE.startsWith('https:')) {
      await this.test('HTTPS enforcement', async () => {
        const httpUrl = API_BASE.replace('https:', 'http:');
        try {
          const response = await this.makeRequest(`${httpUrl}/me`);
          if (response.statusCode !== 301 && response.statusCode !== 302) {
            throw new Error('HTTP requests should redirect to HTTPS');
          }
        } catch (error) {
          // Connection refused is acceptable for HTTPS-only services
          if (!error.message.includes('ECONNREFUSED')) {
            throw error;
          }
        }
      });
    }

    this.printResults();
  }

  printResults() {
    console.log('\n📊 Security Test Results');
    console.log('========================');
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${Math.round((this.passed / (this.passed + this.failed)) * 100)}%\n`);

    if (this.failed > 0) {
      console.log('❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
      console.log('');
    }

    if (this.failed === 0) {
      console.log('🎉 All security tests passed!');
    } else {
      console.log('⚠️  Some security tests failed. Please review and fix the issues.');
      process.exit(1);
    }
  }
}

// Run tests
const tester = new SecurityTester();
tester.runTests().catch(error => {
  console.error('❌ Security test runner failed:', error);
  process.exit(1);
});