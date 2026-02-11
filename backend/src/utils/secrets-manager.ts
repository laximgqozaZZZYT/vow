/**
 * AWS Secrets Manager Utility
 *
 * Provides cached access to secrets stored in AWS Secrets Manager.
 * In Lambda environments, secrets are fetched once on cold start and cached
 * for the lifetime of the execution container.
 *
 * When SECRETS_ARN is not set (e.g., local development), returns an empty
 * object so callers fall back to process.env.
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({
  region: process.env['AWS_REGION'] || 'ap-northeast-1',
});

let cachedSecrets: Record<string, string> | null = null;

/**
 * Fetch secrets from Secrets Manager (cached after first call).
 *
 * Returns an empty object when SECRETS_ARN is not configured,
 * allowing callers to fall back to process.env transparently.
 */
export async function getSecrets(): Promise<Record<string, string>> {
  if (cachedSecrets) return cachedSecrets;

  const secretArn = process.env['SECRETS_ARN'];
  if (!secretArn) {
    // SECRETS_ARN not set — development environment, return empty so process.env is used
    return {};
  }

  const command = new GetSecretValueCommand({ SecretId: secretArn });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error('Secret value is empty');
  }

  cachedSecrets = JSON.parse(response.SecretString) as Record<string, string>;
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
