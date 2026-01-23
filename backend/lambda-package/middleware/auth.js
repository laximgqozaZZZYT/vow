/**
 * JWT Authentication Middleware for Hono
 *
 * Provides JWT token validation for protected endpoints.
 * Supports both Supabase JWT (ES256, HS256) and AWS Cognito JWT (RS256).
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
 */
import * as jose from 'jose';
import { getSettings } from '../config.js';
import { AuthenticationError, TokenExpiredError } from '../errors/index.js';
import { getLogger } from '../utils/logger.js';
const logger = getLogger('middleware.auth');
// Cache for JWKS (JSON Web Key Set)
const jwksCache = new Map();
const JWKS_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds
/**
 * Paths that don't require authentication (without stage prefix).
 */
const EXCLUDED_PATHS = [
    '/health',
    '/docs',
    '/redoc',
    '/openapi.json',
    '/',
    '/api/slack/connect', // OAuth initiation - token passed via query param
    '/api/slack/commands',
    '/api/slack/interactions',
    '/api/slack/events',
    '/api/slack/callback', // OAuth callback doesn't have auth header
];
/**
 * Known API Gateway stage prefixes.
 */
const STAGE_PREFIXES = ['/development', '/production', '/staging'];
/**
 * Strip API Gateway stage prefix from path.
 *
 * API Gateway adds stage name (e.g., /development, /production) to the path.
 * This function removes it for consistent path matching.
 */
function stripStagePrefix(path) {
    for (const prefix of STAGE_PREFIXES) {
        if (path.startsWith(prefix)) {
            const stripped = path.slice(prefix.length);
            return stripped || '/';
        }
    }
    return path;
}
/**
 * Check if path is excluded from authentication.
 */
function isExcludedPath(path) {
    const normalizedPath = stripStagePrefix(path);
    for (const excluded of EXCLUDED_PATHS) {
        if (normalizedPath === excluded || normalizedPath.startsWith(`${excluded}/`)) {
            return true;
        }
    }
    return false;
}
/**
 * Extract JWT token from Authorization header.
 */
function extractToken(c) {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}
/**
 * Fetch and cache JWKS from a URL.
 */
async function fetchJWKS(url) {
    const cached = jwksCache.get(url);
    const now = Date.now();
    if (cached && now - cached.fetchedAt < JWKS_CACHE_TTL) {
        return cached.keys;
    }
    logger.info('Fetching JWKS', { url });
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch JWKS: ${response.status} ${response.statusText}`);
    }
    const jwks = (await response.json());
    jwksCache.set(url, {
        keys: jwks.keys,
        fetchedAt: now,
    });
    logger.info('JWKS fetched successfully', { keys_count: jwks.keys.length });
    return jwks.keys;
}
/**
 * Get public key from JWKS by key ID.
 */
async function getPublicKeyFromJWKS(jwksUrl, kid) {
    const keys = await fetchJWKS(jwksUrl);
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
    const importedKey = await jose.importJWK(key, key.alg);
    // jose.importJWK can return Uint8Array for symmetric keys, but we expect KeyLike for asymmetric
    if (importedKey instanceof Uint8Array) {
        throw new AuthenticationError('Expected asymmetric key but got symmetric key');
    }
    return importedKey;
}
/**
 * Verify Supabase JWT token.
 *
 * Supports both:
 * - ES256 (asymmetric): Uses JWKS endpoint to get public key
 * - HS256 (symmetric): Uses JWT_SECRET for verification
 */
async function verifySupabaseToken(token, settings) {
    // Decode header to check algorithm
    const protectedHeader = jose.decodeProtectedHeader(token);
    const tokenAlg = protectedHeader.alg;
    const tokenKid = protectedHeader.kid;
    logger.info('Verifying Supabase token', {
        algorithm: tokenAlg,
        kid: tokenKid,
    });
    // Determine verification method based on algorithm
    if (['ES256', 'ES384', 'ES512', 'RS256', 'RS384', 'RS512'].includes(tokenAlg || '')) {
        // Asymmetric algorithm - use JWKS
        return verifyWithJWKS(token, tokenAlg, tokenKid, settings);
    }
    // Symmetric algorithm (HS256, etc.) - use JWT_SECRET
    const secret = new TextEncoder().encode(settings.jwtSecret);
    const verifyOptions = {
        algorithms: ['HS256', 'HS384', 'HS512'],
    };
    if (settings.jwtAudience) {
        verifyOptions.audience = settings.jwtAudience;
    }
    if (settings.jwtIssuer) {
        verifyOptions.issuer = settings.jwtIssuer;
    }
    try {
        const { payload } = await jose.jwtVerify(token, secret, verifyOptions);
        return payload;
    }
    catch (error) {
        if (error instanceof jose.errors.JWTExpired) {
            throw new TokenExpiredError();
        }
        throw new AuthenticationError('Invalid authentication token');
    }
}
/**
 * Verify JWT using JWKS public key.
 */
async function verifyWithJWKS(token, alg, kid, settings) {
    if (!settings.supabaseUrl) {
        throw new AuthenticationError('SUPABASE_URL is not configured');
    }
    const jwksUrl = `${settings.supabaseUrl}/auth/v1/.well-known/jwks.json`;
    const publicKey = await getPublicKeyFromJWKS(jwksUrl, kid);
    const verifyOptions = {
        algorithms: [alg],
    };
    if (settings.jwtAudience) {
        verifyOptions.audience = settings.jwtAudience;
    }
    try {
        const { payload } = await jose.jwtVerify(token, publicKey, verifyOptions);
        return payload;
    }
    catch (error) {
        if (error instanceof jose.errors.JWTExpired) {
            throw new TokenExpiredError();
        }
        throw new AuthenticationError('Invalid authentication token');
    }
}
/**
 * Verify Cognito JWT token (RS256).
 *
 * Uses public key from JWKS for verification.
 */
async function verifyCognitoToken(token, settings) {
    if (!settings.cognitoUserPoolId || !settings.cognitoRegion) {
        throw new AuthenticationError('Cognito configuration is missing');
    }
    // Decode header to get key ID
    const protectedHeader = jose.decodeProtectedHeader(token);
    const tokenKid = protectedHeader.kid;
    // Build JWKS URL
    const jwksUrl = `https://cognito-idp.${settings.cognitoRegion}.amazonaws.com/` +
        `${settings.cognitoUserPoolId}/.well-known/jwks.json`;
    // Get public key
    const publicKey = await getPublicKeyFromJWKS(jwksUrl, tokenKid);
    // Expected issuer
    const issuer = `https://cognito-idp.${settings.cognitoRegion}.amazonaws.com/` +
        `${settings.cognitoUserPoolId}`;
    const verifyOptions = {
        algorithms: ['RS256'],
        issuer,
    };
    if (settings.cognitoClientId) {
        verifyOptions.audience = settings.cognitoClientId;
    }
    try {
        const { payload } = await jose.jwtVerify(token, publicKey, verifyOptions);
        // Verify token_use claim
        const tokenUse = payload['token_use'];
        if (tokenUse !== 'id' && tokenUse !== 'access') {
            throw new AuthenticationError('Invalid token_use claim');
        }
        return payload;
    }
    catch (error) {
        if (error instanceof jose.errors.JWTExpired) {
            throw new TokenExpiredError();
        }
        if (error instanceof AuthenticationError) {
            throw error;
        }
        throw new AuthenticationError('Invalid authentication token');
    }
}
/**
 * JWT Authentication Middleware for Hono.
 *
 * Validates JWT tokens from Authorization header and attaches
 * user information to context variables.
 *
 * Supports:
 * - Supabase JWT (ES256, HS256)
 * - AWS Cognito JWT (RS256)
 *
 * Handles API Gateway stage prefixes (e.g., /development, /production)
 * by stripping them before matching excluded paths.
 */
export function jwtAuthMiddleware() {
    return async (c, next) => {
        const settings = getSettings();
        // Skip authentication for OPTIONS requests (CORS preflight)
        if (c.req.method === 'OPTIONS') {
            logger.info('Skipping auth for OPTIONS preflight request');
            return next();
        }
        // Debug logging for path analysis
        const originalPath = c.req.path;
        const normalizedPath = stripStagePrefix(originalPath);
        logger.info('Auth middleware processing request', {
            original_path: originalPath,
            normalized_path: normalizedPath,
        });
        // Skip authentication for excluded paths
        if (isExcludedPath(originalPath)) {
            logger.info('Path excluded from authentication', { path: originalPath });
            return next();
        }
        // Extract token from Authorization header
        const token = extractToken(c);
        if (!token) {
            throw new AuthenticationError('Missing authentication token');
        }
        // Verify token and extract user info
        try {
            let payload;
            if (settings.authProvider === 'cognito') {
                payload = await verifyCognitoToken(token, settings);
            }
            else {
                payload = await verifySupabaseToken(token, settings);
            }
            // Store user in context variables
            c.set('user', payload);
        }
        catch (error) {
            if (error instanceof TokenExpiredError) {
                throw error;
            }
            if (error instanceof AuthenticationError) {
                throw error;
            }
            logger.error('Authentication error', error);
            throw new AuthenticationError(`Authentication error: ${error.message}`);
        }
        return next();
    };
}
/**
 * Get current authenticated user from context.
 *
 * @throws AuthenticationError if user is not authenticated
 */
export function getCurrentUser(c) {
    const user = c.get('user');
    if (!user) {
        throw new AuthenticationError('Not authenticated');
    }
    return user;
}
/**
 * Get current user's ID from context.
 *
 * Works with both Supabase and Cognito tokens.
 *
 * @throws AuthenticationError if user is not authenticated or ID not found
 */
export function getUserId(c) {
    const user = getCurrentUser(c);
    const userId = user.sub;
    if (!userId) {
        throw new AuthenticationError('User ID not found in token');
    }
    return userId;
}
/**
 * Get current user's email from context.
 *
 * Works with both Supabase and Cognito tokens.
 */
export function getUserEmail(c) {
    const user = getCurrentUser(c);
    return user.email;
}
/**
 * Clear JWKS cache (useful for testing).
 */
export function clearJWKSCache() {
    jwksCache.clear();
}
/**
 * Add a path to the excluded paths list.
 * Useful for dynamically adding public endpoints.
 */
export function addExcludedPath(path) {
    if (!EXCLUDED_PATHS.includes(path)) {
        EXCLUDED_PATHS.push(path);
    }
}
/**
 * Remove a path from the excluded paths list.
 */
export function removeExcludedPath(path) {
    const index = EXCLUDED_PATHS.indexOf(path);
    if (index > -1) {
        EXCLUDED_PATHS.splice(index, 1);
    }
}
/**
 * Get the list of excluded paths.
 */
export function getExcludedPaths() {
    return [...EXCLUDED_PATHS];
}
//# sourceMappingURL=auth.js.map