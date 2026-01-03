import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ensureDatabaseUrlFromSecrets } from './runtime/dbUrl'

const execFileAsync = promisify(execFile)

function logEnvSummary() {
  const host = process.env.DB_HOST || ''
  const name = process.env.DB_NAME || ''
  const secret = process.env.DB_SECRET_ARN ? 'set' : 'missing'
  // Intentionally do NOT log passwords / urls.
  console.log('[migrate] target', { host, name, dbSecretArn: secret })
}

async function run() {
  console.log('[migrate] starting')
  logEnvSummary()

  // Ensure DATABASE_URL is available in AWS runtime
  await ensureDatabaseUrlFromSecrets()

  // Prisma reads schema from prisma/schema.prisma and migrations from prisma/migrations
  // We execute prisma CLI via local node_modules.
  const prismaBin = require.resolve('prisma/build/index.js')

  console.log('[migrate] running prisma migrate deploy')
  const { stdout, stderr } = await execFileAsync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    env: process.env,
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  })

  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)

  console.log('[migrate] done')
}

// Lambda handler
export async function handler() {
  try {
    await run()
    return { ok: true }
  } catch (e: any) {
    console.error('[migrate] failed', e?.message || e)
    // Re-throw to show Lambda invocation error (and fail CI/manual checks)
    throw e
  }
}

// Allow local execution: `node dist/migrate.js`
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  run().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
