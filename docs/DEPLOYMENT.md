# GeoBam Deployment Notes

## Single-page application fallback

GeoBam uses client-side routing with clean paths such as `/countries-quiz`.

The production host must rewrite requests that do not match a real static file to `/index.html`. Without this SPA fallback, following an in-app link works, but directly loading or refreshing a route such as `https://geobam.com/countries-quiz` returns a server-level 404.

The fallback must:

- Preserve real asset, manifest, service-worker, and content-pack requests.
- Return `/index.html` for unknown application routes.
- Preserve the original browser URL so the Preact router can render the correct page.
- Be tested using a direct request and hard refresh on `/countries-quiz` and `/capitals-quiz`.

GeoBam targets Cloudflare Workers with Static Assets. `wrangler.jsonc` sets
`assets.not_found_handling` to `single-page-application`, which supplies this
fallback without routing real files through application HTML.

## PWA and service-worker delivery

Production must use HTTPS. Serve `/sw.js` with `Cache-Control: no-cache` so browsers
revalidate the worker and discover new releases promptly. Hashed files under
`/assets/` may use long-lived immutable caching.

Deploy all generated files atomically. In particular, do not publish a new
`sw.js` before every revisioned asset referenced by its precache manifest is
available. Keep the previous deployment's hashed assets available during the
rollout so an already installed worker cannot lose its working offline version.

After deployment, verify:

- `/sw.js` is returned as JavaScript rather than the SPA fallback.
- `/manifest.webmanifest` is returned with the correct manifest content type.
- The first online load finishes installing the worker and its complete precache.
- Reloading `/` and `/countries-quiz` works with the browser network disabled.
- A waiting worker does not activate during a country round.
- The waiting worker activates and reloads seamlessly on the menu or round-complete screen.

## Cloudflare Workers deployment

The production Worker is named `geobam` and is configured with custom domains
for `geobam.com` and `www.geobam.com`. Both domains must exist in the
authenticated Cloudflare account before the first production deployment.

Authenticate locally with `npx wrangler login`, then use:

```sh
npm run deploy:check
npm run deploy
```

`deploy:check` performs a build and Wrangler dry run without publishing.
`deploy` builds and publishes the Worker configuration and static assets
together. For CI, provide a scoped `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secret rather than running interactive login.

The root `wrangler.jsonc` is the only source of deployment configuration.
`assets.directory` points Wrangler straight at the Vite build output, so
there is no generated `dist/wrangler.json` to edit or regenerate.

## Continuous integration

Deployments are driven by **Cloudflare Workers Builds**, which is connected
to this GitHub repository. Each push runs:

1. the build command (`npm run build`), then
2. the deploy command (`npx wrangler deploy`).

The build image is Ubuntu 24.04 with Node.js 24 and npm 10 by default. Pin a
different runtime by adding a `.nvmrc` or `.node-version` file. Wrangler
requires Node.js 22 or newer.

Build results are reported on the commit as a `Workers Builds: geobam` check
run, and the full log is under **Workers & Pages → geobam → Settings →
Builds** in the Cloudflare dashboard. The GitHub check run only contains a
link to that log, so read the log there rather than looking for annotations
on the commit.

`npm run verify:deploy` checks the deployment configuration statically and
runs as part of `npm run build`. It fails the build when:

- `vite.config.ts` imports a module that is not listed in `package.json`
  (this happened when `@cloudflare/vite-plugin` was removed from the
  dependencies but the import was left behind, failing the build with
  `TS2307: Cannot find module`),
- `wrangler.jsonc` declares an `assets` block without `directory` (which
  fails the deploy step with "The `assets` property in your configuration is
  missing the required `directory` property"),
- a stale `.wrangler/deploy/config.json` redirect points at a config that no
  longer exists.

## Stale Wrangler deploy redirects

Earlier revisions deployed through Cloudflare's official Vite plugin, which
wrote a `.wrangler/deploy/config.json` redirect pointing Wrangler at a
generated `dist/wrangler.json`. That plugin has been removed, so the
generated file no longer exists, but the redirect can survive in an existing
working copy and makes every deploy fail with:

```text
ERROR  There is a deploy configuration at ".wrangler/deploy/config.json".
But the redirected configuration path it points to, "dist/wrangler.json",
does not exist.
```

`npm run deploy:clean` (also run automatically by `npm run deploy` and
`npm run deploy:check`) removes that redirect when — and only when — the
config it points at is missing, so a working redirect is left untouched. A
fresh clone has no `.wrangler` directory and never hits this.
