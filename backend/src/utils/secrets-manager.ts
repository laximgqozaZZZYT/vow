/**
 * AWS Secrets Manager Utility
 *
 * Provides cached access to secrets stored in AWS Secrets Manager.
 * In Lambda environments, secrets are fetched once on cold start and cached
 * for the lifetime of the execution container.
 *
 * Supports group-specific secret ARNs for least-privilege access:
 *   AUTH_SECRETS_ARN        -> JWT_SECRET, SUPABASE_SERVICE_ROLE_KEY
 *   SLACK_SECRETS_ARN       -> SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, TOKEN_ENCRYPTION_KEY
 *   API_SECRETS_ARN         -> OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *   CREDENTIALS_SECRETS_ARN -> CREDENTIALS_ENCRYPTION_KEY
 *
 * Falls back to the legacy SECRETS_ARN (combined secret) for backward compatibility.
 * When no ARN is set (e.g., local development), returns an empty object so
 * callers fall back to process.env.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
});

let cachedSecrets: Record<string, string> | null = null;

/**
 * Group-specific secret ARN environment variable names.
 * Each maps to a separate Secrets Manager secret containing
 * only the keys relevant to that functional group.
 */
const SECRET_GROUP_ARN_KEYS = [
  'AUTH_SECRETS_ARN',
  'SLACK_SECRETS_ARN',
  'API_SECRETS_ARN',
  'CREDENTIALS_SECRETS_ARN',
] as const;

/**
 * Fetch a single secret from Secrets Manager by ARN.
 * Returns the parsed JSON key-value pairs, or an empty object on failure.
 */
async function fetchSecretByArn(arn: string): Promise<Record<string, string>> {
  const command = new GetSecretValueCommand({ SecretId: arn });
  const response = await client.send(command);

  if (!response.SecretString) {
    // VOW expects JSON-formatted secrets only (SecretBinary is not supported)
    console.warn(`Secret value is empty for ARN: ${arn}`);
    return {};
  }

  const parsed: unknown = JSON.parse(response.SecretString);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    console.error(`Invalid secret format for ARN: ${arn}`);
    return {};
  }
  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      validated[key] = value;
    }
  }
  return validated;
}

/**
 * Fetch secrets from Secrets Manager (cached after first call).
 *
 * Loading strategy:
 * 1. If group-specific ARNs are set (AUTH_SECRETS_ARN, SLACK_SECRETS_ARN, etc.),
 *    fetch each group in parallel and merge the results.
 * 2. If only the legacy SECRETS_ARN is set, fetch the combined secret.
 * 3. If no ARN is set, return an empty object (development fallback).
 *
 * Group-specific secrets take precedence over the legacy combined secret
 * when both are present (migration period).
 */
export async function getSecrets(): Promise<Record<string, string>> {
  if (cachedSecrets) return cachedSecrets;

  const merged: Record<string, string> = {};

  // Step 1: Load legacy combined secret (SECRETS_ARN) as baseline
  const legacyArn = process.env['SECRETS_ARN'];
  if (legacyArn) {
    try {
      const legacySecrets = await fetchSecretByArn(legacyArn);
      Object.assign(merged, legacySecrets);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to load legacy SECRETS_ARN: ${message}`);
    }
  }

  // Step 2: Load group-specific secrets in parallel (override legacy values)
  const groupArns: Array<{ key: string; arn: string }> = [];
  for (const key of SECRET_GROUP_ARN_KEYS) {
    const arn = process.env[key];
    if (arn) {
      groupArns.push({ key, arn });
    }
  }

  if (groupArns.length > 0) {
    const results = await Promise.allSettled(
      groupArns.map(async ({ key, arn }) => {
        try {
          return await fetchSecretByArn(arn);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Failed to load secret group ${key}: ${message}`);
          return {};
        }
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        Object.assign(merged, result.value);
      }
    }
  }

  // If no secrets were loaded at all (no ARNs configured), return empty
  // so callers fall back to process.env (development environment)
  if (!legacyArn && groupArns.length === 0) {
    return {};
  }

  cachedSecrets = merged;
  return cachedSecrets;
}

/**
 * Get a specific secret value.
 *
 * Priority: Secrets Manager > process.env > fallback
 */
export async function getSecret(key: string, fallback?: string): Promise<string | undefined> {
  const secrets = await getSecrets();
  return secrets[key] || process.env[key] || fallback;
}

/**
 * Clear the cached secrets (for testing).
 */
export function clearSecretsCache(): void {
  cachedSecrets = null;
}
