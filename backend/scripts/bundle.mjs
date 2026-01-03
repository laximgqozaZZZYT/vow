import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'

const outdir = new URL('../dist-bundle/', import.meta.url)

rmSync(outdir, { recursive: true, force: true })
mkdirSync(outdir, { recursive: true })

/**
 * Notes:
 * - We bundle Lambda handlers to avoid shipping full node_modules.
 * - Prisma is tricky: the client loads native engines at runtime.
 *   We therefore keep `@prisma/client` external so it can resolve its runtime files.
 *   (You'll ship the minimal node_modules subset via `npm prune --omit=dev`.)
 */
const shared = {
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  bundle: true,
  sourcemap: true,
  outdir: outdir.pathname,
  external: [
    '@prisma/client',
    'prisma/build/index.js',
    // Prisma engines are required dynamically.
    '.prisma/client/*',
  ],
}

await build({
  ...shared,
  entryPoints: [{ in: 'src/lambda.ts', out: 'lambda' }],
})

await build({
  ...shared,
  entryPoints: [{ in: 'src/migrate.ts', out: 'migrate' }],
})

console.log('Bundled handlers into dist-bundle/')
