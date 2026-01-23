/**
 * Application Configuration
 *
 * Uses Zod for environment variable validation.
 * All sensitive values should be provided via environment variables.
 *
 * Requirements: 9.3
 */

import { z } from 'zod';

/**
 * Environment variable schema with Zod validation.
 */
const envSchema = z.object({
  // Application
  APP_NAME: z.string().default('Vow Backend API'),
  APP_VERSION: z.string().default('1.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3001'),

  // Database - Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // JWT Authentication (Supabase)
  JWT_SECRET: z.string().default('dev-secret-key-change-in-production'),
  JWT_ALGORITHM: z.enum(['HS256', 'RS256', 'ES256']).default('HS256'),
  JWT_AUDIENCE: z.string().default('authenticated'),
  JWT_ISSUER: z.string().optional(),

  // Cognito Authentication (AWS)
  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_CLIENT_ID: z.string().optional(),
  COGNITO_REGION: z.string().default('ap-northeast-1'),
  AUTH_PROVIDER: z.enum(['supabase', 'cognito']).default('supabase'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Slack Integration
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  SLACK_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_CALLBACK_URI: z.string().url().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // OpenAI Integration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ENABLED: z.string().transform((v) => v === 'true').default('false'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_REQUESTS_PER_MINUTE: z.string().transform(Number).default('60'),
});

/**
 * Parsed and validated environment variables type.
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Parse CORS origins from environment variable.
 * Supports both JSON array and comma-separated formats.
 */
function parseCorsOrigins(corsOriginsStr: string): string[] {
  if (!corsOriginsStr) {
    return ['http://localhost:3000'];
  }

  // Try to parse as JSON array first (Terraform jsonencode format)
  if (corsOriginsStr.startsWith('[')) {
    try {
      const origins = JSON.parse(corsOriginsStr) as unknown;
      if (Array.isArray(origins)) {
        return origins.map((o) => String(o).trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma-separated parsing
    }
  }

  // Fall back to comma-separated format
  return corsOriginsStr.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * Application settings loaded from environment variables.
 */
export interface Settings {
  // Application
  appName: string;
  appVersion: string;
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  debug: boolean;

  // Database - Supabase
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  supabaseServiceRoleKey: string | undefined;

  // JWT Authentication
  jwtSecret: string;
  jwtAlgorithm: 'HS256' | 'RS256' | 'ES256';
  jwtAudience: string;
  jwtIssuer: string | undefined;

  // Cognito Authentication
  cognitoUserPoolId: string | undefined;
  cognitoClientId: string | undefined;
  cognitoRegion: string;
  authProvider: 'supabase' | 'cognito';

  // CORS
  corsOrigins: string[];

  // Slack Integration
  slackWebhookUrl: string | undefined;
  slackEnabled: boolean;
  slackClientId: string | undefined;
  slackClientSecret: string | undefined;
  slackSigningSecret: string | undefined;
  slackCallbackUri: string | undefined;
  tokenEncryptionKey: string | undefined;

  // OpenAI Integration
  openaiApiKey: string | undefined;
  openaiEnabled: boolean;
  openaiModel: string;
  openaiMaxRequestsPerMinute: number;
}

/**
 * Load and validate settings from environment variables.
 */
function loadSettings(): Settings {
  const env = envSchema.parse(process.env);

  return {
    // Application
    appName: env.APP_NAME,
    appVersion: env.APP_VERSION,
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    debug: env.NODE_ENV === 'development',

    // Database - Supabase
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,

    // JWT Authentication
    jwtSecret: env.JWT_SECRET,
    jwtAlgorithm: env.JWT_ALGORITHM,
    jwtAudience: env.JWT_AUDIENCE,
    jwtIssuer: env.JWT_ISSUER,

    // Cognito Authentication
    cognitoUserPoolId: env.COGNITO_USER_POOL_ID,
    cognitoClientId: env.COGNITO_CLIENT_ID,
    cognitoRegion: env.COGNITO_REGION,
    authProvider: env.AUTH_PROVIDER,

    // CORS
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),

    // Slack Integration
    slackWebhookUrl: env.SLACK_WEBHOOK_URL,
    slackEnabled: env.SLACK_ENABLED,
    slackClientId: env.SLACK_CLIENT_ID,
    slackClientSecret: env.SLACK_CLIENT_SECRET,
    slackSigningSecret: env.SLACK_SIGNING_SECRET,
    slackCallbackUri: env.SLACK_CALLBACK_URI,
    tokenEncryptionKey: env.TOKEN_ENCRYPTION_KEY,

    // OpenAI Integration
    openaiApiKey: env.OPENAI_API_KEY,
    openaiEnabled: env.OPENAI_ENABLED,
    openaiModel: env.OPENAI_MODEL,
    openaiMaxRequestsPerMinute: env.OPENAI_MAX_REQUESTS_PER_MINUTE,
  };
}

/**
 * Validate required settings on startup.
 * @throws Error if required settings are missing
 */
export function validateRequiredSettings(settings: Settings): void {
  const errors: string[] = [];

  if (settings.jwtSecret === 'dev-secret-key-change-in-production' && !settings.debug) {
    errors.push('JWT_SECRET must be set in production');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
}

/**
 * Validate Slack-related settings.
 * @returns List of missing configuration variables
 */
export function validateSlackSettings(settings: Settings): string[] {
  const errors: string[] = [];

  if (!settings.slackClientId) {
    errors.push('SLACK_CLIENT_ID is required for Slack integration');
  }
  if (!settings.slackClientSecret) {
    errors.push('SLACK_CLIENT_SECRET is required for Slack integration');
  }
  if (!settings.slackSigningSecret) {
    errors.push('SLACK_SIGNING_SECRET is required for Slack integration');
  }
  if (!settings.tokenEncryptionKey) {
    errors.push('TOKEN_ENCRYPTION_KEY is required for Slack integration');
  }
  if (!settings.supabaseUrl) {
    errors.push('SUPABASE_URL is required for Slack connection storage');
  }
  if (!settings.supabaseAnonKey) {
    errors.push('SUPABASE_ANON_KEY is required for Slack connection storage');
  }

  return errors;
}

// Global settings instance (lazy loaded)
let _settings: Settings | null = null;

/**
 * Get the global settings instance.
 * Settings are loaded and validated on first access.
 */
export function getSettings(): Settings {
  if (_settings === null) {
    _settings = loadSettings();
  }
  return _settings;
}

/**
 * Reset settings (useful for testing).
 */
export function resetSettings(): void {
  _settings = null;
}

// Export settings as default for convenience
export const settings = getSettings();
