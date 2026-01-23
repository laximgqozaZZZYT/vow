/**
 * Slack Integration Service
 *
 * Core service for Slack API interactions including OAuth, messaging, and webhook handling.
 *
 * Requirements:
 * - 4.1: Define a hierarchy of custom exception classes
 * - 4.7: Verify Slack request signatures using HMAC-SHA256
 * - 4.8: Validate timestamp is within 5 minutes to prevent replay attacks
 * - 4.9: Handle OAuth token exchange
 * - 4.10: Send messages to Slack with rate limit handling
 */

import { webcrypto } from 'node:crypto';
import { getSettings } from '../config.js';
import { SlackAPIError, RateLimitError } from '../errors/index.js';
import { getLogger } from '../utils/logger.js';
import { encryptToken } from '../utils/encryption.js';
import type {
  SlackMessage,
  SlackMessageResponse,
  SlackOAuthTokenResponse,
  SlackConnectionCreate,
} from '../schemas/slack.js';

const logger = getLogger('slackService');

// Use Web Crypto API from Node.js
const crypto = webcrypto;

/**
 * Token expired error for Slack API.
 */
export class TokenExpiredError extends SlackAPIError {
  override readonly name = 'TokenExpiredError';
  
  constructor(message: string) {
    super(message, 'token_expired');
  }
}

/**
 * Circuit breaker state.
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Simple circuit breaker implementation.
 *
 * Prevents cascading failures by temporarily blocking requests
 * when too many failures occur.
 */
export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private failures: number;
  private successes: number;
  private state: CircuitState;
  private lastFailureTime: number | null;

  constructor(
    failureThreshold = 5,
    successThreshold = 2,
    timeout = 30
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout; // seconds
    this.failures = 0;
    this.successes = 0;
    this.state = 'closed';
    this.lastFailureTime = null;
  }

  /**
   * Record a successful call.
   */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === 'closed') {
      this.failures = 0;
    }
  }

  /**
   * Record a failed call.
   */
  recordFailure(): void {
    this.failures += 1;
    this.successes = 0;
    this.lastFailureTime = Date.now() / 1000; // Convert to seconds

    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /**
   * Check if a call can be executed.
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }

    if (this.state === 'open') {
      if (this.lastFailureTime && (Date.now() / 1000 - this.lastFailureTime) > this.timeout) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }

    // half-open
    return true;
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }
}

/**
 * Service for Slack API interactions.
 */
export class SlackIntegrationService {
  private static readonly SLACK_API_BASE = 'https://slack.com/api';
  private static readonly SLACK_OAUTH_AUTHORIZE = 'https://slack.com/oauth/v2/authorize';

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly signingSecret: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor() {
    const settings = getSettings();
    this.clientId = settings.slackClientId ?? '';
    this.clientSecret = settings.slackClientSecret ?? '';
    this.signingSecret = settings.slackSigningSecret ?? '';
    this.circuitBreaker = new CircuitBreaker();
  }

  // ========================================================================
  // OAuth Methods
  // ========================================================================

  /**
   * Generate Slack OAuth authorization URL.
   *
   * @param redirectUri - The redirect URI after OAuth
   * @param state - State parameter for CSRF protection
   * @param scopes - OAuth scopes to request
   * @returns The OAuth authorization URL
   */
  getOAuthUrl(
    redirectUri: string,
    state: string,
    scopes?: string[]
  ): string {
    const defaultScopes = ['chat:write', 'commands', 'users:read', 'im:write'];
    const scopeList = scopes ?? defaultScopes;

    const params = new URLSearchParams({
      client_id: this.clientId,
      scope: scopeList.join(','),
      redirect_uri: redirectUri,
      state,
    });

    return `${SlackIntegrationService.SLACK_OAUTH_AUTHORIZE}?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access tokens.
   *
   * @param code - The authorization code from Slack
   * @param redirectUri - The redirect URI used in the authorization request
   * @returns The OAuth token response
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<SlackOAuthTokenResponse> {
    const response = await fetch(`${SlackIntegrationService.SLACK_API_BASE}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json() as SlackOAuthTokenResponse;
    return data;
  }

  /**
   * Revoke an access token.
   *
   * @param token - The token to revoke
   * @returns True if revocation was successful
   */
  async revokeToken(token: string): Promise<boolean> {
    const response = await fetch(`${SlackIntegrationService.SLACK_API_BASE}/auth.revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json() as { ok: boolean };
    return data.ok ?? false;
  }

  /**
   * Refresh an expired access token.
   *
   * @param refreshToken - The refresh token
   * @returns The new OAuth token response, or null if refresh failed
   */
  async refreshToken(refreshToken: string): Promise<SlackOAuthTokenResponse | null> {
    const response = await fetch(`${SlackIntegrationService.SLACK_API_BASE}/oauth.v2.access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json() as SlackOAuthTokenResponse;
    if (data.ok) {
      return data;
    }
    return null;
  }

  // ========================================================================
  // Messaging Methods
  // ========================================================================

  /**
   * Send a message to Slack.
   *
   * @param token - Bot or user access token
   * @param message - Message to send
   * @param retryCount - Number of retries on rate limit
   * @returns SlackMessageResponse with result
   * @throws SlackAPIError if circuit breaker is open or request fails
   * @throws RateLimitError if rate limited after all retries
   * @throws TokenExpiredError if token is expired or invalid
   */
  async sendMessage(
    token: string,
    message: SlackMessage,
    retryCount = 3
  ): Promise<SlackMessageResponse> {
    if (!this.circuitBreaker.canExecute()) {
      throw new SlackAPIError('Circuit breaker is open');
    }

    const payload: Record<string, unknown> = {
      channel: message.channel,
      text: message.text,
    };

    if (message.blocks) {
      payload['blocks'] = message.blocks;
    }

    if (message.thread_ts) {
      payload['thread_ts'] = message.thread_ts;
    }

    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const response = await fetch(`${SlackIntegrationService.SLACK_API_BASE}/chat.postMessage`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json() as SlackMessageResponse;

        if (data.ok) {
          this.circuitBreaker.recordSuccess();
          return data;
        }

        const error = data.error ?? 'unknown_error';

        if (error === 'ratelimited') {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
          if (attempt < retryCount - 1) {
            await this.sleep(retryAfter * 1000 * Math.pow(2, attempt));
            continue;
          }
          throw new RateLimitError(retryAfter);
        }

        if (error === 'token_expired' || error === 'invalid_auth') {
          throw new TokenExpiredError(`Token error: ${error}`);
        }

        this.circuitBreaker.recordFailure();
        return { ok: false, error };
      } catch (e) {
        if (e instanceof SlackAPIError || e instanceof RateLimitError || e instanceof TokenExpiredError) {
          throw e;
        }

        this.circuitBreaker.recordFailure();
        if (attempt < retryCount - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw new SlackAPIError(`Request failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    throw new SlackAPIError('Max retries exceeded');
  }

  /**
   * Send a response to a Slack interaction via response_url.
   *
   * @param responseUrl - The response URL from the interaction
   * @param text - Fallback text
   * @param blocks - Optional Block Kit blocks
   * @param replaceOriginal - Whether to replace the original message
   * @returns True if successful
   */
  async sendResponse(
    responseUrl: string,
    text: string,
    blocks?: Record<string, unknown>[],
    replaceOriginal = false
  ): Promise<boolean> {
    const payload: Record<string, unknown> = {
      text,
      replace_original: replaceOriginal,
    };

    if (blocks) {
      payload['blocks'] = blocks;
    }

    const response = await fetch(responseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return response.status === 200;
  }

  // ========================================================================
  // Webhook Security
  // ========================================================================

  /**
   * Verify Slack request signature using HMAC-SHA256.
   *
   * Property 6: Slack Signature Verification
   * For any Slack request with timestamp and signature, if the signature is valid
   * HMAC-SHA256 of "v0:{timestamp}:{body}" and timestamp is within 5 minutes,
   * verification should succeed. Otherwise, verification should fail.
   *
   * @param timestamp - X-Slack-Request-Timestamp header
   * @param body - Raw request body as string
   * @param signature - X-Slack-Signature header
   * @returns True if signature is valid
   *
   * Requirements: 4.7, 4.8
   */
  async verifySignature(
    timestamp: string,
    body: string,
    signature: string
  ): Promise<boolean> {
    if (!this.signingSecret) {
      logger.warning('Slack signing secret not configured');
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    try {
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - requestTime) > 300) {
        logger.warning('Slack request timestamp outside 5 minute window', {
          request_time: requestTime,
          current_time: currentTime,
          difference_seconds: Math.abs(currentTime - requestTime),
        });
        return false;
      }
    } catch {
      logger.warning('Invalid timestamp format', { timestamp });
      return false;
    }

    // Compute expected signature
    const sigBasestring = `v0:${timestamp}:${body}`;
    const expectedSignature = await this.computeHmacSha256(sigBasestring);

    // Compare signatures using constant-time comparison
    return this.timingSafeEqual(expectedSignature, signature);
  }

  /**
   * Compute HMAC-SHA256 signature using Web Crypto API.
   *
   * @param message - The message to sign
   * @returns The signature in "v0=<hex>" format
   */
  private async computeHmacSha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.signingSecret);
    const messageData = encoder.encode(message);

    // Import the key
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the message
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);

    // Convert to hex string
    const signatureArray = new Uint8Array(signatureBuffer);
    const hexSignature = Array.from(signatureArray)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `v0=${hexSignature}`;
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   *
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  // ========================================================================
  // User Info Methods
  // ========================================================================

  /**
   * Get Slack user information.
   *
   * @param token - Access token
   * @param userId - Slack user ID
   * @returns User info object, or null if not found
   */
  async getUserInfo(token: string, userId: string): Promise<Record<string, unknown> | null> {
    const response = await fetch(
      `${SlackIntegrationService.SLACK_API_BASE}/users.info?user=${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json() as { ok: boolean; user?: Record<string, unknown> };
    if (data.ok) {
      return data.user ?? null;
    }
    return null;
  }

  /**
   * Open or get DM channel with a user.
   *
   * @param token - Access token
   * @param userId - Slack user ID
   * @returns Channel ID, or null if failed
   */
  async getUserDmChannel(token: string, userId: string): Promise<string | null> {
    const response = await fetch(`${SlackIntegrationService.SLACK_API_BASE}/conversations.open`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ users: userId }),
    });

    const data = await response.json() as {
      ok: boolean;
      channel?: { id?: string };
    };

    if (data.ok) {
      return data.channel?.id ?? null;
    }
    return null;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Create a SlackConnectionCreate from OAuth token response.
   *
   * @param tokenResponse - The OAuth token response from Slack
   * @returns SlackConnectionCreate object with encrypted tokens
   */
  async createConnectionFromOAuth(
    tokenResponse: SlackOAuthTokenResponse
  ): Promise<SlackConnectionCreate> {
    const team = tokenResponse.team ?? {};
    const authedUser = tokenResponse.authed_user ?? {};

    return {
      slack_user_id: authedUser['id'] ?? '',
      slack_team_id: team['id'] ?? '',
      slack_team_name: team['name'],
      slack_user_name: undefined, // Can be fetched separately
      access_token: await encryptToken(tokenResponse.access_token ?? ''),
      refresh_token: tokenResponse.refresh_token
        ? await encryptToken(tokenResponse.refresh_token)
        : undefined,
      bot_access_token: undefined, // Set if using bot token
      token_expires_at: undefined, // Set based on token type
    };
  }

  /**
   * Get the circuit breaker instance (for testing).
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Sleep for a specified number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
let _slackService: SlackIntegrationService | null = null;

/**
 * Get or create the singleton Slack service instance.
 */
export function getSlackService(): SlackIntegrationService {
  if (_slackService === null) {
    _slackService = new SlackIntegrationService();
  }
  return _slackService;
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetSlackService(): void {
  _slackService = null;
}
