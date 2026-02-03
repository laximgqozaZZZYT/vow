/**
 * MCP Installer Lambda
 *
 * Serves the MCP Task Distribution Server installer via API Gateway.
 * Endpoints:
 *   GET /mcp-installer/install.sh - Returns the installer script
 *   GET /mcp-installer/health - Health check
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as fs from 'fs';
import * as path from 'path';

// Read installer script at cold start
const INSTALLER_SCRIPT = fs.readFileSync(
  path.join(__dirname, 'install.sh'),
  'utf-8'
);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const path = event.path || event.rawPath || '';

  // Health check
  if (path.endsWith('/health')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'healthy',
        service: 'mcp-installer',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Serve installer script
  if (path.endsWith('/install.sh') || path.endsWith('/install')) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'inline; filename="install.sh"',
        'Cache-Control': 'public, max-age=3600',
      },
      body: INSTALLER_SCRIPT,
    };
  }

  // Default: redirect to install.sh
  return {
    statusCode: 302,
    headers: {
      Location: '/mcp-installer/install.sh',
    },
    body: '',
  };
};
