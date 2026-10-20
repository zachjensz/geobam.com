# GeoBam Deployment Notes

## Single-page application fallback

GeoBam uses client-side routing with clean paths such as `/countries-quiz`.

The production host must rewrite requests that do not match a real static file to `/index.html`. Without this SPA fallback, following an in-app link works, but directly loading or refreshing a route such as `https://geobam.com/countries-quiz` returns a server-level 404.

The fallback must:

- Preserve real asset, manifest, service-worker, and content-pack requests.
- Return `/index.html` for unknown application routes.
- Preserve the original browser URL so the Preact router can render the correct page.
- Be tested using a direct request and hard refresh on `/countries-quiz` and `/capitals-quiz`.

GeoBam targets Cloudflare Workers with Static Assets through Cloudflare's official
Vite plugin. `wrangler.jsonc` sets `assets.not_found_handling` to
`single-page-application`, which supplies this fallback without routing real
files through application HTML.

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
`deploy` builds and publishes the generated Worker configuration and static
assets together. For CI, provide a scoped `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` secret rather than running interactive login.

The official Cloudflare Vite adapter generates `dist/wrangler.json` for Wrangler.
Do not edit that generated file; source deployment configuration belongs in the
root `wrangler.jsonc`.
