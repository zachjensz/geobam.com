#!/usr/bin/env node
/**
 * Guards the deployment configuration against the two failure modes that
 * broke Cloudflare Workers Builds on this project.
 *
 * 1. `vite.config.ts` imported `@cloudflare/vite-plugin` after the package had
 *    been removed from `package.json`. The build then died with
 *    "Cannot find module '@cloudflare/vite-plugin'" (TS2307) and every CI
 *    build failed.
 *
 * 2. `wrangler.jsonc` declared an `assets` block without `directory`, so
 *    `wrangler deploy` aborted with "The `assets` property in your
 *    configuration is missing the required `directory` property."
 *
 * Both are cheap to detect statically, and both are invisible until a CI
 * build runs, so they are checked here instead.
 *
 * Usage: npm run verify:deploy
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8')
const wranglerConfig = readFileSync(join(root, 'wrangler.jsonc'), 'utf8')

// --- 1. every module imported by vite.config.ts must be a declared dependency
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
])

const importPattern = /^\s*import\s[^'"]*['"]([^'"]+)['"]/gm
for (const match of viteConfig.matchAll(importPattern)) {
  const specifier = match[1]
  if (!specifier.startsWith('.')) {
    const packageName = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]
    if (!declared.has(packageName)) {
      problems.push(
        `vite.config.ts imports "${packageName}", but it is not listed in package.json dependencies or devDependencies.`,
      )
    }
  }
}

// --- 2. wrangler.jsonc must give the assets block a directory
const assetsMatch = wranglerConfig.match(/"assets"\s*:\s*\{([^}]*)\}/)
if (!assetsMatch) {
  problems.push('wrangler.jsonc has no "assets" block, so static assets would not be deployed.')
} else if (!/"directory"\s*:/.test(assetsMatch[1])) {
  problems.push(
    'wrangler.jsonc declares an "assets" block without "directory"; wrangler deploy will fail with "The `assets` property in your configuration is missing the required `directory` property."',
  )
}

// --- 3. a stale deploy redirect must not be left pointing at a missing config
try {
  const { existsSync, readFileSync: read } = await import('node:fs')
  const deployConfigPath = join(root, '.wrangler', 'deploy', 'config.json')
  if (existsSync(deployConfigPath)) {
    const deployConfig = JSON.parse(read(deployConfigPath, 'utf8'))
    if (deployConfig.configPath) {
      const redirected = resolve(dirname(deployConfigPath), deployConfig.configPath)
      if (!existsSync(redirected)) {
        problems.push(
          `.wrangler/deploy/config.json points at "${deployConfig.configPath}", which does not exist. Run "npm run deploy:clean" to remove the stale redirect.`,
        )
      }
    }
  }
} catch {
  // A malformed redirect is handled by scripts/clean-wrangler-redirect.mjs.
}

if (problems.length > 0) {
  console.error('Deployment configuration is inconsistent:\n')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('')
  process.exit(1)
}

console.log('Deployment configuration looks consistent.')
