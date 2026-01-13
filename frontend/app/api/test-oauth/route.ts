/**
 * Test OAuth API Endpoint
 * Simple endpoint to test OAuth token validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { withOAuth } from '../../../lib/oauth/token-middleware';

/**
 * GET /api/test-oauth
 * Test endpoint that requires OAuth authentication
 */
export const GET = withOAuth(async (request: NextRequest, oauth) => {
  return NextResponse.json({
    message: 'OAuth authentication successful!',
    oauth: {
      userId: oauth.userId,
      clientId: oauth.clientId,
      scope: oauth.scope,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/test-oauth
 * Test endpoint for POST requests with OAuth
 */
export const POST = withOAuth(async (request: NextRequest, oauth) => {
  const body = await request.json().catch(() => ({}));
  
  return NextResponse.json({
    message: 'OAuth POST request successful!',
    oauth: {
      userId: oauth.userId,
      clientId: oauth.clientId,
      scope: oauth.scope,
    },
    requestBody: body,
    timestamp: new Date().toISOString(),
  });
});