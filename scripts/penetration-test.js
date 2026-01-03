#!/usr/bin/env node

/**
 * ペネトレーションテストスクリプト
 * より高度なセキュリティ攻撃パターンをテスト
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const API_BASE = process.env.API_URL || 'http://localhost:4000';

class PenetrationTester {
  constructor() {
    this.results = [];
    this.vulnerabilities = [];
    this.warnings = [];
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
      req.setTimeout(15000, () => reject(new Error('Request timeout')));
      
      if (options.body) {
        req.write(options.body);
      }
      req.end();
    });
  }

  logVulnerability(severity, title, description) {
    this.vulnerabilities.push({ severity, title, description });
    console.log(`🚨 ${severity.toUpperCase()}: ${title}`);
    console.log(`   ${description}\n`);
  }

  logWarning(title, description) {
    this.warnings.push({ title, description });
    console.log(`⚠️  WARNING: ${title}`);
    console.log(`   ${description}\n`);
  }

  async testAuthenticationBypass() {
    console.log('🔍 Testing Authentication Bypass Attacks...\n');

    // Test 1: JWT None Algorithm Attack
    try {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ 
        sub: 'fake-user-id',
        email: 'attacker@evil.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64url');
      const fakeJwt = `${header}.${payload}.`;

      const response = await this.makeRequest(`${API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${fakeJwt}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        if (body.actor && body.actor.type === 'user') {
          this.logVulnerability('critical', 'JWT None Algorithm Attack', 
            'Server accepts JWT tokens with "none" algorithm, allowing authentication bypass');
        }
      }
    } catch (error) {
      // Expected to fail
    }

    // Test 2: JWT Secret Brute Force (skip if using Supabase JWKS)
    const usingSupabase = process.env.SUPABASE_JWKS_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!usingSupabase) {
      const weakSecrets = ['secret', '123456', 'password', 'jwt-secret', 'your-secret-key'];
      for (const secret of weakSecrets) {
        try {
          const header = { alg: 'HS256', typ: 'JWT' };
          const payload = { 
            sub: 'fake-user-id',
            email: 'attacker@evil.com',
            exp: Math.floor(Date.now() / 1000) + 3600
          };

          const token = this.createJWT(header, payload, secret);
          const response = await this.makeRequest(`${API_BASE}/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.statusCode === 200) {
            this.logVulnerability('high', 'Weak JWT Secret', 
              `JWT secret is weak and can be brute-forced: "${secret}"`);
            break;
          }
        } catch (error) {
          // Expected to fail
        }
      }
    } else {
      console.log('ℹ️  Skipping JWT secret brute force test (using Supabase JWKS)');
    }
  }

  createJWT(header, payload, secret) {
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${signature}`;
  }

  async testInjectionAttacks() {
    console.log('🔍 Testing Injection Attacks...\n');

    // SQL Injection payloads
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1#"
    ];

    for (const payload of sqlPayloads) {
      try {
        const response = await this.makeRequest(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload,
            password: 'password'
          })
        });

        if (response.statusCode === 200) {
          this.logVulnerability('critical', 'SQL Injection Vulnerability',
            `SQL injection payload succeeded: ${payload}`);
        } else if (response.statusCode === 500) {
          this.logWarning('Potential SQL Injection', 
            `Server error with SQL payload: ${payload} - Check logs for SQL errors`);
        }
      } catch (error) {
        // Expected to fail
      }
    }

    // NoSQL Injection (if using MongoDB)
    try {
      const response = await this.makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: { $ne: null },
          password: { $ne: null }
        })
      });

      if (response.statusCode === 200) {
        this.logVulnerability('critical', 'NoSQL Injection Vulnerability',
          'Server accepts NoSQL injection payloads');
      }
    } catch (error) {
      // Expected to fail
    }
  }

  async testSessionManagement() {
    console.log('🔍 Testing Session Management...\n');

    // Test session fixation
    try {
      const response1 = await this.makeRequest(`${API_BASE}/me`);
      const cookies1 = response1.headers['set-cookie'] || [];
      
      const response2 = await this.makeRequest(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': cookies1.join('; ')
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      });

      const cookies2 = response2.headers['set-cookie'] || [];
      
      // Check if session ID changed after login
      const sessionBefore = this.extractSessionId(cookies1);
      const sessionAfter = this.extractSessionId(cookies2);
      
      if (sessionBefore && sessionAfter && sessionBefore === sessionAfter) {
        this.logVulnerability('medium', 'Session Fixation',
          'Session ID does not change after authentication');
      }
    } catch (error) {
      // Expected behavior
    }

    // Test session cookie security
    try {
      const response = await this.makeRequest(`${API_BASE}/me`);
      const cookies = response.headers['set-cookie'] || [];
      
      for (const cookie of cookies) {
        if (cookie.includes('session') || cookie.includes('auth')) {
          if (!cookie.includes('HttpOnly')) {
            this.logVulnerability('medium', 'Insecure Cookie',
              'Session cookie missing HttpOnly flag');
          }
          if (!cookie.includes('Secure') && API_BASE.startsWith('https:')) {
            this.logVulnerability('medium', 'Insecure Cookie',
              'Session cookie missing Secure flag for HTTPS');
          }
          if (!cookie.includes('SameSite')) {
            this.logWarning('Missing SameSite Cookie Attribute',
              'Session cookie should include SameSite attribute for CSRF protection');
          }
        }
      }
    } catch (error) {
      // Expected behavior
    }
  }

  extractSessionId(cookies) {
    for (const cookie of cookies) {
      const match = cookie.match(/session[^=]*=([^;]+)/);
      if (match) return match[1];
    }
    return null;
  }

  async testCORSMisconfiguration() {
    console.log('🔍 Testing CORS Misconfiguration...\n');

    const maliciousOrigins = [
      'https://evil.com',
      'http://attacker.localhost',
      'null',
      'https://sub.yourdomain.com.evil.com'
    ];

    for (const origin of maliciousOrigins) {
      try {
        const response = await this.makeRequest(`${API_BASE}/me`, {
          method: 'OPTIONS',
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization'
          }
        });

        const allowedOrigin = response.headers['access-control-allow-origin'];
        if (allowedOrigin === origin || allowedOrigin === '*') {
          this.logVulnerability('high', 'CORS Misconfiguration',
            `Malicious origin allowed: ${origin}`);
        }
      } catch (error) {
        // Expected to fail
      }
    }
  }

  async testRateLimiting() {
    console.log('🔍 Testing Rate Limiting...\n');

    // Brute force login attempt
    const requests = [];
    for (let i = 0; i < 50; i++) {
      requests.push(
        this.makeRequest(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            password: `wrong-password-${i}`
          })
        })
      );
    }

    try {
      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.statusCode === 429);
      
      if (!rateLimited) {
        this.logWarning('No Rate Limiting Detected',
          'API does not implement rate limiting for login attempts');
      }

      // Check for account lockout
      const successfulAttempts = responses.filter(r => r.statusCode === 200).length;
      if (successfulAttempts > 0) {
        this.logVulnerability('medium', 'No Account Lockout',
          'Account does not get locked after multiple failed login attempts');
      }
    } catch (error) {
      console.log('Rate limiting test failed:', error.message);
    }
  }

  async testInformationDisclosure() {
    console.log('🔍 Testing Information Disclosure...\n');

    // Test error messages
    const testCases = [
      { endpoint: '/auth/login', payload: { email: 'nonexistent@test.com', password: 'wrong' } },
      { endpoint: '/auth/register', payload: { email: 'invalid-email', password: 'short' } },
      { endpoint: '/nonexistent-endpoint', payload: {} }
    ];

    for (const testCase of testCases) {
      try {
        const response = await this.makeRequest(`${API_BASE}${testCase.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testCase.payload)
        });

        if (response.body.includes('stack') || response.body.includes('Error:')) {
          this.logVulnerability('low', 'Information Disclosure',
            `Detailed error information exposed at ${testCase.endpoint}`);
        }
      } catch (error) {
        // Expected behavior
      }
    }

    // Test server headers
    try {
      const response = await this.makeRequest(`${API_BASE}/me`);
      const serverHeader = response.headers['server'];
      const xPoweredBy = response.headers['x-powered-by'];
      
      if (serverHeader) {
        this.logWarning('Server Information Disclosure',
          `Server header reveals: ${serverHeader}`);
      }
      
      if (xPoweredBy) {
        this.logWarning('Technology Stack Disclosure',
          `X-Powered-By header reveals: ${xPoweredBy}`);
      }
    } catch (error) {
      // Expected behavior
    }
  }

  async runAllTests() {
    console.log('🔴 Starting Penetration Tests\n');
    console.log('⚠️  WARNING: These tests may trigger security alerts\n');

    await this.testAuthenticationBypass();
    await this.testInjectionAttacks();
    await this.testSessionManagement();
    await this.testCORSMisconfiguration();
    await this.testRateLimiting();
    await this.testInformationDisclosure();

    this.printResults();
  }

  printResults() {
    console.log('\n📊 Penetration Test Results');
    console.log('============================');
    
    if (this.vulnerabilities.length === 0) {
      console.log('✅ No critical vulnerabilities found!');
    } else {
      console.log(`🚨 Found ${this.vulnerabilities.length} vulnerabilities:`);
      
      const critical = this.vulnerabilities.filter(v => v.severity === 'critical');
      const high = this.vulnerabilities.filter(v => v.severity === 'high');
      const medium = this.vulnerabilities.filter(v => v.severity === 'medium');
      const low = this.vulnerabilities.filter(v => v.severity === 'low');
      
      if (critical.length > 0) console.log(`   🔴 Critical: ${critical.length}`);
      if (high.length > 0) console.log(`   🟠 High: ${high.length}`);
      if (medium.length > 0) console.log(`   🟡 Medium: ${medium.length}`);
      if (low.length > 0) console.log(`   🟢 Low: ${low.length}`);
    }

    if (this.warnings.length > 0) {
      console.log(`⚠️  Found ${this.warnings.length} warnings`);
    }

    console.log('\n📋 Recommendations:');
    console.log('- Implement rate limiting for authentication endpoints');
    console.log('- Add account lockout after failed login attempts');
    console.log('- Remove server information headers');
    console.log('- Implement proper error handling without information disclosure');
    console.log('- Regular security audits and dependency updates');
    
    if (this.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length > 0) {
      console.log('\n❌ CRITICAL/HIGH vulnerabilities found - DO NOT DEPLOY TO PRODUCTION');
      process.exit(1);
    } else {
      console.log('\n✅ No critical vulnerabilities found - Safe for deployment');
    }
  }
}

// Run penetration tests
const tester = new PenetrationTester();
tester.runAllTests().catch(error => {
  console.error('❌ Penetration test runner failed:', error);
  process.exit(1);
});