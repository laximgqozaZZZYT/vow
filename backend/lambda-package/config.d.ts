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
declare const envSchema: z.ZodObject<{
    APP_NAME: z.ZodDefault<z.ZodString>;
    APP_VERSION: z.ZodDefault<z.ZodString>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    SUPABASE_URL: z.ZodOptional<z.ZodString>;
    SUPABASE_ANON_KEY: z.ZodOptional<z.ZodString>;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodOptional<z.ZodString>;
    JWT_SECRET: z.ZodDefault<z.ZodString>;
    JWT_ALGORITHM: z.ZodDefault<z.ZodEnum<["HS256", "RS256", "ES256"]>>;
    JWT_AUDIENCE: z.ZodDefault<z.ZodString>;
    JWT_ISSUER: z.ZodOptional<z.ZodString>;
    COGNITO_USER_POOL_ID: z.ZodOptional<z.ZodString>;
    COGNITO_CLIENT_ID: z.ZodOptional<z.ZodString>;
    COGNITO_REGION: z.ZodDefault<z.ZodString>;
    AUTH_PROVIDER: z.ZodDefault<z.ZodEnum<["supabase", "cognito"]>>;
    CORS_ORIGINS: z.ZodDefault<z.ZodString>;
    SLACK_WEBHOOK_URL: z.ZodOptional<z.ZodString>;
    SLACK_ENABLED: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
    SLACK_CLIENT_ID: z.ZodOptional<z.ZodString>;
    SLACK_CLIENT_SECRET: z.ZodOptional<z.ZodString>;
    SLACK_SIGNING_SECRET: z.ZodOptional<z.ZodString>;
    SLACK_CALLBACK_URI: z.ZodOptional<z.ZodString>;
    TOKEN_ENCRYPTION_KEY: z.ZodOptional<z.ZodString>;
    OPENAI_API_KEY: z.ZodOptional<z.ZodString>;
    OPENAI_ENABLED: z.ZodDefault<z.ZodEffects<z.ZodString, boolean, string>>;
    OPENAI_MODEL: z.ZodDefault<z.ZodString>;
    OPENAI_MAX_REQUESTS_PER_MINUTE: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
}, "strip", z.ZodTypeAny, {
    APP_NAME: string;
    APP_VERSION: string;
    NODE_ENV: "development" | "production" | "test";
    PORT: number;
    JWT_SECRET: string;
    JWT_ALGORITHM: "HS256" | "RS256" | "ES256";
    JWT_AUDIENCE: string;
    COGNITO_REGION: string;
    AUTH_PROVIDER: "supabase" | "cognito";
    CORS_ORIGINS: string;
    SLACK_ENABLED: boolean;
    OPENAI_ENABLED: boolean;
    OPENAI_MODEL: string;
    OPENAI_MAX_REQUESTS_PER_MINUTE: number;
    SUPABASE_URL?: string | undefined;
    SUPABASE_ANON_KEY?: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
    JWT_ISSUER?: string | undefined;
    COGNITO_USER_POOL_ID?: string | undefined;
    COGNITO_CLIENT_ID?: string | undefined;
    SLACK_WEBHOOK_URL?: string | undefined;
    SLACK_CLIENT_ID?: string | undefined;
    SLACK_CLIENT_SECRET?: string | undefined;
    SLACK_SIGNING_SECRET?: string | undefined;
    SLACK_CALLBACK_URI?: string | undefined;
    TOKEN_ENCRYPTION_KEY?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
}, {
    APP_NAME?: string | undefined;
    APP_VERSION?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    PORT?: string | undefined;
    SUPABASE_URL?: string | undefined;
    SUPABASE_ANON_KEY?: string | undefined;
    SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
    JWT_SECRET?: string | undefined;
    JWT_ALGORITHM?: "HS256" | "RS256" | "ES256" | undefined;
    JWT_AUDIENCE?: string | undefined;
    JWT_ISSUER?: string | undefined;
    COGNITO_USER_POOL_ID?: string | undefined;
    COGNITO_CLIENT_ID?: string | undefined;
    COGNITO_REGION?: string | undefined;
    AUTH_PROVIDER?: "supabase" | "cognito" | undefined;
    CORS_ORIGINS?: string | undefined;
    SLACK_WEBHOOK_URL?: string | undefined;
    SLACK_ENABLED?: string | undefined;
    SLACK_CLIENT_ID?: string | undefined;
    SLACK_CLIENT_SECRET?: string | undefined;
    SLACK_SIGNING_SECRET?: string | undefined;
    SLACK_CALLBACK_URI?: string | undefined;
    TOKEN_ENCRYPTION_KEY?: string | undefined;
    OPENAI_API_KEY?: string | undefined;
    OPENAI_ENABLED?: string | undefined;
    OPENAI_MODEL?: string | undefined;
    OPENAI_MAX_REQUESTS_PER_MINUTE?: string | undefined;
}>;
/**
 * Parsed and validated environment variables type.
 */
export type Env = z.infer<typeof envSchema>;
/**
 * Application settings loaded from environment variables.
 */
export interface Settings {
    appName: string;
    appVersion: string;
    nodeEnv: 'development' | 'production' | 'test';
    port: number;
    debug: boolean;
    supabaseUrl: string | undefined;
    supabaseAnonKey: string | undefined;
    supabaseServiceRoleKey: string | undefined;
    jwtSecret: string;
    jwtAlgorithm: 'HS256' | 'RS256' | 'ES256';
    jwtAudience: string;
    jwtIssuer: string | undefined;
    cognitoUserPoolId: string | undefined;
    cognitoClientId: string | undefined;
    cognitoRegion: string;
    authProvider: 'supabase' | 'cognito';
    corsOrigins: string[];
    slackWebhookUrl: string | undefined;
    slackEnabled: boolean;
    slackClientId: string | undefined;
    slackClientSecret: string | undefined;
    slackSigningSecret: string | undefined;
    slackCallbackUri: string | undefined;
    tokenEncryptionKey: string | undefined;
    openaiApiKey: string | undefined;
    openaiEnabled: boolean;
    openaiModel: string;
    openaiMaxRequestsPerMinute: number;
}
/**
 * Validate required settings on startup.
 * @throws Error if required settings are missing
 */
export declare function validateRequiredSettings(settings: Settings): void;
/**
 * Validate Slack-related settings.
 * @returns List of missing configuration variables
 */
export declare function validateSlackSettings(settings: Settings): string[];
/**
 * Get the global settings instance.
 * Settings are loaded and validated on first access.
 */
export declare function getSettings(): Settings;
/**
 * Reset settings (useful for testing).
 */
export declare function resetSettings(): void;
export declare const settings: Settings;
export {};
//# sourceMappingURL=config.d.ts.map