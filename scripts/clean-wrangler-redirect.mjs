#!/usr/bin/env node
/**
 * Removes a stale Wrangler deploy redirect.
 *
 * The Cloudflare Vite plugin used to write `.wrangler/deploy/config.json`,
 * pointing Wrangler at a generated `dist/wrangler.json`. The plugin has since
 * been removed in favour of a plain `assets.directory` in `wrangler.jsonc`,
 * so that generated file no longer exists — but the redirect survives in
 * local working copies, and Wrangler refuses to deploy while it points at a
 * missing config:
 *
 *   ERROR  There is a deploy configuration at ".wrangler/deploy/config.json".
 *   But the redirected configuration path it points to, "dist/wrangler.json",
 *   does not exist.
 *
 * This script deletes the redirect only when it is actually broken, so a
 * working redirect (for example one written by a future plugin) is left alone.
 *
 * Usage: npm run deploy:clean
 */
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deployConfigPath = resolve(projectRoot, '.wrangler', 'deploy', 'config.json')

if (!existsSync(deployConfigPath)) {
  console.log('No Wrangler deploy redirect present; nothing to clean.')
  process.exit(0)
}

let configPath
try {
  const deployConfig = JSON.parse(readFileSync(deployConfigPath, 'utf8'))
  configPath = deployConfig.configPath
} catch {
  configPath = undefined
}

if (!configPath) {
  rmSync(deployConfigPath, { force: true })
  console.log(`Removed malformed Wrangler deploy redirect: ${relative(projectRoot, deployConfigPath)}`)
  process.exit(0)
}

const redirectedPath = isAbsolute(configPath)
  ? configPath
  : resolve(dirname(deployConfigPath), configPath)

if (existsSync(redirectedPath)) {
  console.log(
    `Wrangler deploy redirect is still valid (points at ${relative(projectRoot, redirectedPath)}); leaving it in place.`,
  )
  process.exit(0)
}

rmSync(deployConfigPath, { force: true })
console.log(
  `Removed stale Wrangler deploy redirect pointing at missing ${relative(projectRoot, redirectedPath)}.`,
)
