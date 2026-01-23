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
import { SlackAPIError } from '../errors';
import type { SlackMessage, SlackMessageResponse, SlackOAuthTokenResponse, SlackConnectionCreate } from '../schemas/slack';
/**
 * Token expired error for Slack API.
 */
export declare class TokenExpiredError extends SlackAPIError {
    constructor(message: string);
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
export declare class CircuitBreaker {
    private readonly failureThreshold;
    private readonly successThreshold;
    private readonly timeout;
    private failures;
    private successes;
    private state;
    private lastFailureTime;
    constructor(failureThreshold?: number, successThreshold?: number, timeout?: number);
    /**
     * Record a successful call.
     */
    recordSuccess(): void;
    /**
     * Record a failed call.
     */
    recordFailure(): void;
    /**
     * Check if a call can be executed.
     */
    canExecute(): boolean;
    /**
     * Get current circuit state.
     */
    getState(): CircuitState;
}
/**
 * Service for Slack API interactions.
 */
export declare class SlackIntegrationService {
    private static readonly SLACK_API_BASE;
    private static readonly SLACK_OAUTH_AUTHORIZE;
    private readonly clientId;
    private readonly clientSecret;
    private readonly signingSecret;
    private readonly circuitBreaker;
    constructor();
    /**
     * Generate Slack OAuth authorization URL.
     *
     * @param redirectUri - The redirect URI after OAuth
     * @param state - State parameter for CSRF protection
     * @param scopes - OAuth scopes to request
     * @returns The OAuth authorization URL
     */
    getOAuthUrl(redirectUri: string, state: string, scopes?: string[]): string;
    /**
     * Exchange OAuth code for access tokens.
     *
     * @param code - The authorization code from Slack
     * @param redirectUri - The redirect URI used in the authorization request
     * @returns The OAuth token response
     */
    exchangeCodeForTokens(code: string, redirectUri: string): Promise<SlackOAuthTokenResponse>;
    /**
     * Revoke an access token.
     *
     * @param token - The token to revoke
     * @returns True if revocation was successful
     */
    revokeToken(token: string): Promise<boolean>;
    /**
     * Refresh an expired access token.
     *
     * @param refreshToken - The refresh token
     * @returns The new OAuth token response, or null if refresh failed
     */
    refreshToken(refreshToken: string): Promise<SlackOAuthTokenResponse | null>;
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
    sendMessage(token: string, message: SlackMessage, retryCount?: number): Promise<SlackMessageResponse>;
    /**
     * Send a response to a Slack interaction via response_url.
     *
     * @param responseUrl - The response URL from the interaction
     * @param text - Fallback text
     * @param blocks - Optional Block Kit blocks
     * @param replaceOriginal - Whether to replace the original message
     * @returns True if successful
     */
    sendResponse(responseUrl: string, text: string, blocks?: Record<string, unknown>[], replaceOriginal?: boolean): Promise<boolean>;
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
    verifySignature(timestamp: string, body: string, signature: string): Promise<boolean>;
    /**
     * Compute HMAC-SHA256 signature using Web Crypto API.
     *
     * @param message - The message to sign
     * @returns The signature in "v0=<hex>" format
     */
    private computeHmacSha256;
    /**
     * Constant-time string comparison to prevent timing attacks.
     *
     * @param a - First string
     * @param b - Second string
     * @returns True if strings are equal
     */
    private timingSafeEqual;
    /**
     * Get Slack user information.
     *
     * @param token - Access token
     * @param userId - Slack user ID
     * @returns User info object, or null if not found
     */
    getUserInfo(token: string, userId: string): Promise<Record<string, unknown> | null>;
    /**
     * Open or get DM channel with a user.
     *
     * @param token - Access token
     * @param userId - Slack user ID
     * @returns Channel ID, or null if failed
     */
    getUserDmChannel(token: string, userId: string): Promise<string | null>;
    /**
     * Create a SlackConnectionCreate from OAuth token response.
     *
     * @param tokenResponse - The OAuth token response from Slack
     * @returns SlackConnectionCreate object with encrypted tokens
     */
    createConnectionFromOAuth(tokenResponse: SlackOAuthTokenResponse): Promise<SlackConnectionCreate>;
    /**
     * Get the circuit breaker instance (for testing).
     */
    getCircuitBreaker(): CircuitBreaker;
    /**
     * Sleep for a specified number of milliseconds.
     */
    private sleep;
}
/**
 * Get or create the singleton Slack service instance.
 */
export declare function getSlackService(): SlackIntegrationService;
/**
 * Reset the singleton instance (useful for testing).
 */
export declare function resetSlackService(): void;
export {};
//# sourceMappingURL=slackService.d.ts.map