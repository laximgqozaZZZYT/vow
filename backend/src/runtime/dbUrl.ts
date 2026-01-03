type DbSecret = { username: string; password: string }

function assertEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env ${name}`)
  return v
}

function normalizeHost(host: string) {
  // Prisma/MySQL connection strings don't like stray whitespace.
  return host.trim()
}

export async function ensureDatabaseUrlFromSecrets(): Promise<void> {
  // If DATABASE_URL is already provided (e.g. local dev), keep it.
  if (process.env.DATABASE_URL) return

  // Only attempt Secrets Manager in AWS runtime. In local dev we expect DATABASE_URL to be set.
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error('DATABASE_URL is not set (local). Set DATABASE_URL or run within AWS Lambda with DB_SECRET_ARN.')
  }

  const secretArn = process.env.DB_SECRET_ARN
  if (!secretArn) throw new Error('Missing env DB_SECRET_ARN (or provide DATABASE_URL directly)')

  const host = normalizeHost(assertEnv('DB_HOST'))
  const port = process.env.DB_PORT ? String(process.env.DB_PORT) : '3306'
  const dbName = assertEnv('DB_NAME')

  // Dynamic import so local dev doesn't require the AWS SDK.
  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
  const client = new SecretsManagerClient({})
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretArn }))
  const raw = res.SecretString
  if (!raw) throw new Error('DB secret has empty SecretString')

  let parsed: DbSecret
  try {
    parsed = JSON.parse(raw)
  } catch (e: any) {
    throw new Error(`DB secret is not valid JSON: ${e?.message || e}`)
  }

  if (!parsed.username || !parsed.password) {
    throw new Error('DB secret must include {username,password}')
  }

  const u = encodeURIComponent(parsed.username)
  const p = encodeURIComponent(parsed.password)
  process.env.DATABASE_URL = `mysql://${u}:${p}@${host}:${port}/${dbName}`
}
