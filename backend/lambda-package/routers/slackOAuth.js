/**
 * Slack OAuth Router
 *
 * Handles OAuth 2.0 flow for connecting Slack workspaces.
 *
 * Requirements:
 * - 10.1: THE Backend_API SHALL maintain the same endpoint paths as the Python backend
 * - 10.2: THE Backend_API SHALL maintain the same request/response schemas as the Python backend
 *
 * Python equivalent: backend/app/routers/slack_oauth.py
 */
import { Hono } from 'hono';
import * as jose from 'jose';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { getSettings } from '../config.js';
import { getLogger } from '../utils/logger.js';
import { decryptToken } from '../utils/encryption.js';
import { getSlackService } from '../services/slackService.js';
import { SlackRepository } from '../repositories/slackRepository.js';
import { AuthenticationError } from '../errors/index.js';
const logger = getLogger('slackOAuth');
// =============================================================================
// Zod Schemas for Request Validation
// =============================================================================
const connectQuerySchema = z.object({
    redirect_uri: z.string().optional(),
    token: z.string().optional(),
});
const callbackQuerySchema = z.object({
    code: z.string(),
    state: z.string(),
    error: z.string().optional(),
});
const preferencesUpdateSchema = z.object({
    slack_notifications_enabled: z.boolean().optional(),
    weekly_slack_report_enabled: z.boolean().optional(),
    weekly_report_day: z.number().int().min(0).max(6).optional(),
    weekly_report_time: z.string().optional(),
});
// =============================================================================
// OAuth State Management Helper Functions
// =============================================================================
/**
 * Save OAuth state to Supabase for Lambda stateless environment.
 */
async function saveOAuthState(supabase, state, ownerType, ownerId, redirectUri) {
    try {
        const { error } = await supabase.from('slack_oauth_states').insert({
            state,
            owner_type: ownerType,
            owner_id: ownerId,
            redirect_uri: redirectUri,
        });
        if (error) {
            logger.error('Failed to save OAuth state', new Error(error.message));
            return false;
        }
        logger.info('OAuth state saved to database', { state_prefix: state.slice(0, 8) });
        return true;
    }
    catch (e) {
        logger.error('Failed to save OAuth state', e);
        return false;
    }
}
/**
 * Get and delete OAuth state from Supabase (atomic operation).
 */
async function getAndDeleteOAuthState(supabase, state) {
    try {
        // Get the state
        const { data, error } = await supabase
            .from('slack_oauth_states')
            .select('*')
            .eq('state', state)
            .single();
        if (error || !data) {
            logger.warning('OAuth state not found', { state_prefix: state.slice(0, 8) });
            return null;
        }
        // Check expiration
        const expiresAt = new Date(data['expires_at']);
        if (new Date() > expiresAt) {
            logger.warning('OAuth state expired', { state_prefix: state.slice(0, 8) });
            // Delete expired state
            await supabase.from('slack_oauth_states').delete().eq('state', state);
            return null;
        }
        // Delete the state (one-time use)
        await supabase.from('slack_oauth_states').delete().eq('state', state);
        logger.info('OAuth state retrieved and deleted', { state_prefix: state.slice(0, 8) });
        return {
            owner_type: data['owner_type'],
            owner_id: data['owner_id'],
            redirect_uri: data['redirect_uri'] ?? '',
            timestamp: new Date(data['created_at']).getTime() / 1000,
        };
    }
    catch (e) {
        logger.error('Failed to get OAuth state', e);
        return null;
    }
}
/**
 * Clean up expired OAuth states from database.
 */
async function cleanupExpiredOAuthStates(supabase) {
    try {
        const now = new Date().toISOString();
        await supabase.from('slack_oauth_states').delete().lt('expires_at', now);
    }
    catch (e) {
        logger.warning('Failed to cleanup expired OAuth states', { error: e.message });
    }
}
// =============================================================================
// JWT Verification Functions
// =============================================================================
// Cache for JWKS
let supabaseJwksCache = null;
const JWKS_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
/**
 * Fetch and cache Supabase JWKS.
 */
async function getSupabaseJwks(settings) {
    const now = Date.now();
    if (supabaseJwksCache && now - supabaseJwksCache.fetchedAt < JWKS_CACHE_TTL) {
        return supabaseJwksCache.keys;
    }
    if (!settings.supabaseUrl) {
        throw new Error('SUPABASE_URL is not configured');
    }
    const jwksUrl = `${settings.supabaseUrl}/auth/v1/.well-known/jwks.json`;
    logger.info('Fetching JWKS', { url: jwksUrl });
    const response = await fetch(jwksUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status}`);
    }
    const jwks = (await response.json());
    supabaseJwksCache = { keys: jwks.keys, fetchedAt: now };
    logger.info('JWKS fetched', { keys_count: jwks.keys.length });
    return jwks.keys;
}
/**
 * Verify JWT using JWKS public key.
 */
async function verifyWithJwks(token, alg, kid, settings) {
    const keys = await getSupabaseJwks(settings);
    let key;
    if (kid) {
        key = keys.find((k) => k.kid === kid);
        if (!key && keys.length > 0) {
            logger.warning('No key found with matching kid, using first available key', { kid });
            key = keys[0];
        }
    }
    else if (keys.length > 0) {
        key = keys[0];
    }
    if (!key) {
        throw new AuthenticationError('No public keys available in JWKS');
    }
    const publicKey = await jose.importJWK(key, alg);
    if (publicKey instanceof Uint8Array) {
        throw new AuthenticationError('Expected asymmetric key but got symmetric key');
    }
    const { payload } = await jose.jwtVerify(token, publicKey, {
        algorithms: [alg],
        audience: settings.jwtAudience,
    });
    return payload;
}
/**
 * Verify JWT token and extract user info.
 *
 * Supports both:
 * - ES256 (asymmetric): Uses JWKS endpoint to get public key
 * - HS256 (symmetric): Uses JWT_SECRET for verification
 */
async function verifyJwtToken(token, settings) {
    try {
        // Get token header to check algorithm
        const protectedHeader = jose.decodeProtectedHeader(token);
        const tokenAlg = protectedHeader.alg ?? 'unknown';
        const tokenKid = protectedHeader.kid;
        logger.info('Token verification', { algorithm: tokenAlg, kid: tokenKid });
        let payload;
        // Determine verification method based on algorithm
        if (['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512'].includes(tokenAlg)) {
            // Asymmetric algorithm - use JWKS
            payload = await verifyWithJwks(token, tokenAlg, tokenKid, settings);
        }
        else {
            // Symmetric algorithm (HS256, etc.) - use JWT_SECRET
            const secret = new TextEncoder().encode(settings.jwtSecret);
            const result = await jose.jwtVerify(token, secret, {
                algorithms: ['HS256', 'HS384', 'HS512'],
                audience: settings.jwtAudience,
            });
            payload = result.payload;
        }
        const userId = payload.sub;
        if (!userId) {
            throw new AuthenticationError('Invalid token: no user ID');
        }
        return { id: userId, type: 'user' };
    }
    catch (e) {
        if (e instanceof jose.errors.JWTExpired) {
            logger.error('JWT verification failed: token expired');
            throw new AuthenticationError('Token has expired');
        }
        logger.error('JWT verification failed', e);
        throw new AuthenticationError('Invalid or expired token');
    }
}
/**
 * Get current authenticated user from context.
 */
function getCurrentUser(c) {
    const user = c.get('user');
    if (!user) {
        throw new AuthenticationError('Not authenticated');
    }
    const userId = user.sub;
    if (!userId) {
        throw new AuthenticationError('User ID not found in token');
    }
    return { id: userId, type: 'user' };
}
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Generate a cryptographically secure random state token.
 */
function generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Get Supabase client instance.
 */
function getSupabaseClient(settings) {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
        throw new Error('Supabase is not configured');
    }
    return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
}
/**
 * Build error redirect URL.
 */
function getErrorRedirect(errorCode, message, redirectBase) {
    const base = redirectBase ?? process.env['FRONTEND_URL'] ?? 'https://main.do1k9oyyorn24.amplifyapp.com';
    return `${base}/settings?error=${errorCode}&message=${encodeURIComponent(message)}`;
}
// =============================================================================
// Router Factory
// =============================================================================
/**
 * Create the Slack OAuth router with all endpoints.
 */
export function createSlackOAuthRouter() {
    const router = new Hono();
    /**
     * GET /api/slack/connect
     *
     * Initiate Slack OAuth flow.
     * Redirects user to Slack authorization page.
     *
     * Token can be passed via:
     * 1. Query parameter (for redirect-based flow)
     * 2. Authorization header (via middleware)
     */
    router.get('/connect', async (c) => {
        const settings = getSettings();
        const slackService = getSlackService();
        // Parse query parameters
        const query = connectQuerySchema.safeParse({
            redirect_uri: c.req.query('redirect_uri'),
            token: c.req.query('token'),
        });
        if (!query.success) {
            return c.json({ error: 'Invalid query parameters' }, 400);
        }
        const { redirect_uri: redirectUri, token } = query.data;
        // Get user from token (query param) or middleware
        let currentUser;
        try {
            if (token) {
                currentUser = await verifyJwtToken(token, settings);
            }
            else {
                currentUser = getCurrentUser(c);
            }
        }
        catch (e) {
            return c.json({ error: 'Not authenticated. Please provide token.' }, 401);
        }
        // Validate Slack configuration
        if (!settings.slackClientId) {
            logger.error('Slack integration not configured: missing SLACK_CLIENT_ID');
            return c.json({ error: 'Slack integration is not configured. Please contact administrator.' }, 500);
        }
        // Generate state token
        const state = generateState();
        // Store state in database (for Lambda stateless environment)
        const supabase = getSupabaseClient(settings);
        const redirectUriValue = redirectUri ?? settings.slackCallbackUri ?? '';
        if (!(await saveOAuthState(supabase, state, currentUser.type, currentUser.id, redirectUriValue))) {
            return c.json({ error: 'Failed to initialize OAuth flow. Please try again.' }, 500);
        }
        // Clean up expired states in background
        cleanupExpiredOAuthStates(supabase).catch(() => {
            // Ignore cleanup errors
        });
        // Get OAuth URL
        const callbackUri = process.env['SLACK_CALLBACK_URI'] ??
            `${new URL(c.req.url).origin}/api/slack/callback`;
        const oauthUrl = slackService.getOAuthUrl(callbackUri, state);
        return c.redirect(oauthUrl);
    });
    /**
     * GET /api/slack/callback
     *
     * Handle OAuth callback from Slack.
     * Exchanges code for tokens and stores connection.
     */
    router.get('/callback', async (c) => {
        const settings = getSettings();
        const slackService = getSlackService();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Parse query parameters
        const query = callbackQuerySchema.safeParse({
            code: c.req.query('code'),
            state: c.req.query('state'),
            error: c.req.query('error'),
        });
        if (!query.success) {
            return c.redirect(getErrorRedirect('invalid_request', 'Invalid callback parameters'));
        }
        const { code, state, error } = query.data;
        // Check for error from Slack
        if (error) {
            logger.warning('Slack OAuth denied', { error });
            return c.redirect(getErrorRedirect('slack_oauth_denied', error));
        }
        // Validate state from database
        const stateData = await getAndDeleteOAuthState(supabase, state);
        if (!stateData) {
            logger.warning('Invalid OAuth state', { state_prefix: state.slice(0, 8) });
            return c.redirect(getErrorRedirect('invalid_state', 'OAuth state invalid or expired'));
        }
        // Get redirect URI from state
        const redirectUri = stateData.redirect_uri;
        let frontendBase;
        if (redirectUri) {
            try {
                const parsed = new URL(redirectUri);
                frontendBase = `${parsed.protocol}//${parsed.host}`;
            }
            catch {
                // Ignore URL parsing errors
            }
        }
        // Exchange code for tokens
        const callbackUri = process.env['SLACK_CALLBACK_URI'] ?? '';
        let tokenResponse;
        try {
            tokenResponse = await slackService.exchangeCodeForTokens(code, callbackUri);
        }
        catch (e) {
            logger.error('Token exchange failed', e);
            return c.redirect(getErrorRedirect('token_exchange_failed', e.message, frontendBase));
        }
        if (!tokenResponse.ok) {
            logger.error('Token exchange failed', new Error(tokenResponse.error ?? 'Unknown error'));
            return c.redirect(getErrorRedirect('token_exchange_failed', tokenResponse.error ?? 'Unknown error', frontendBase));
        }
        // Create connection
        const connectionData = await slackService.createConnectionFromOAuth(tokenResponse);
        try {
            await slackRepo.createConnection(stateData.owner_type, stateData.owner_id, connectionData);
            logger.info('Slack connection created', { user_id: stateData.owner_id });
        }
        catch (e) {
            logger.error('Failed to save connection', e);
            return c.redirect(getErrorRedirect('connection_failed', e.message, frontendBase));
        }
        // Redirect to settings with success
        const finalRedirect = redirectUri ||
            `${frontendBase ?? 'https://main.do1k9oyyorn24.amplifyapp.com'}/settings`;
        return c.redirect(`${finalRedirect}?slack_connected=true`);
    });
    /**
     * POST /api/slack/disconnect
     *
     * Revoke tokens and remove Slack connection.
     */
    router.post('/disconnect', async (c) => {
        const settings = getSettings();
        const slackService = getSlackService();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Get current user
        let currentUser;
        try {
            currentUser = getCurrentUser(c);
        }
        catch {
            return c.json({ error: 'Not authenticated' }, 401);
        }
        // Get current connection
        const connection = await slackRepo.getConnectionWithTokens(currentUser.type, currentUser.id);
        if (!connection) {
            return c.json({ error: 'No Slack connection found' }, 404);
        }
        // Revoke token
        try {
            const token = await decryptToken(connection['access_token']);
            await slackService.revokeToken(token);
        }
        catch {
            // Continue even if revocation fails
        }
        // Delete connection
        await slackRepo.deleteConnection(currentUser.type, currentUser.id);
        return c.json({ success: true, message: 'Slack disconnected' });
    });
    /**
     * GET /api/slack/status
     *
     * Get current Slack connection status.
     */
    router.get('/status', async (c) => {
        const settings = getSettings();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Get current user
        let currentUser;
        try {
            currentUser = getCurrentUser(c);
        }
        catch {
            return c.json({ error: 'Not authenticated' }, 401);
        }
        const connection = await slackRepo.getConnection(currentUser.type, currentUser.id);
        const preferences = await slackRepo.getPreferences(currentUser.type, currentUser.id);
        const response = {
            connected: connection !== null && (connection.is_valid ?? false),
            connection: connection ?? undefined,
            preferences: preferences ?? undefined,
        };
        return c.json(response);
    });
    /**
     * GET /api/slack/preferences
     *
     * Get Slack notification preferences.
     */
    router.get('/preferences', async (c) => {
        const settings = getSettings();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Get current user
        let currentUser;
        try {
            currentUser = getCurrentUser(c);
        }
        catch {
            return c.json({ error: 'Not authenticated' }, 401);
        }
        const preferences = await slackRepo.getPreferences(currentUser.type, currentUser.id);
        if (!preferences) {
            const defaultPreferences = {
                slack_notifications_enabled: false,
                weekly_slack_report_enabled: false,
                weekly_report_day: 0,
                weekly_report_time: '09:00',
            };
            return c.json(defaultPreferences);
        }
        return c.json(preferences);
    });
    /**
     * PUT /api/slack/preferences
     *
     * Update Slack notification preferences.
     */
    router.put('/preferences', async (c) => {
        const settings = getSettings();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Get current user
        let currentUser;
        try {
            currentUser = getCurrentUser(c);
        }
        catch {
            return c.json({ error: 'Not authenticated' }, 401);
        }
        // Parse request body
        let body;
        try {
            body = await c.req.json();
        }
        catch {
            return c.json({ error: 'Invalid JSON body' }, 400);
        }
        const parseResult = preferencesUpdateSchema.safeParse(body);
        if (!parseResult.success) {
            return c.json({ error: 'Invalid preferences data', details: parseResult.error.issues }, 400);
        }
        const preferences = parseResult.data;
        const updated = await slackRepo.updatePreferences(currentUser.type, currentUser.id, preferences);
        return c.json(updated);
    });
    /**
     * POST /api/slack/test
     *
     * Send a test message to verify Slack connection.
     */
    router.post('/test', async (c) => {
        const settings = getSettings();
        const slackService = getSlackService();
        const supabase = getSupabaseClient(settings);
        const slackRepo = new SlackRepository(supabase);
        // Get current user
        let currentUser;
        try {
            currentUser = getCurrentUser(c);
        }
        catch {
            return c.json({ error: 'Not authenticated' }, 401);
        }
        // Get connection
        const connection = await slackRepo.getConnectionWithTokens(currentUser.type, currentUser.id);
        if (!connection) {
            return c.json({ error: 'No Slack connection found' }, 404);
        }
        if (!connection['is_valid']) {
            return c.json({ error: 'Slack connection is invalid' }, 400);
        }
        try {
            const token = await decryptToken(connection['access_token']);
            const slackUserId = connection['slack_user_id'];
            // Get DM channel
            const channel = await slackService.getUserDmChannel(token, slackUserId);
            if (!channel) {
                return c.json({ error: 'Could not open DM channel' }, 400);
            }
            // Send test message
            const message = {
                channel,
                text: '🎉 Test message from VOW! Your Slack integration is working.',
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: "🎉 *Test message from VOW!*\n\nYour Slack integration is working correctly. You'll receive habit reminders and weekly reports here.",
                        },
                    },
                ],
            };
            const response = await slackService.sendMessage(token, message);
            if (response.ok) {
                return c.json({ success: true, message: 'Test message sent!' });
            }
            else {
                return c.json({ error: `Failed to send message: ${response.error}` }, 400);
            }
        }
        catch (e) {
            return c.json({ error: e.message }, 500);
        }
    });
    return router;
}
// Export default router instance
export const slackOAuthRouter = createSlackOAuthRouter();
//# sourceMappingURL=slackOAuth.js.map