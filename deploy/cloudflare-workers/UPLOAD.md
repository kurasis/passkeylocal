# PassKey Local __VERSION__ — Cloudflare Workers

This is a Workers packaging of the unchanged application __VERSION__, not a new
application release. It preserves the released shell, service worker and headers.

The dashboard screen **Upload static files to update your Worker** accepts only
static assets. Do not drop this archive there: it also needs an executable
same-origin favicon handler. Use Wrangler to update the existing Worker.

1. Export and verify an encrypted backup from your current site.
2. Install Node.js 22.12+ (a current LTS is recommended). Extract this ZIP into its
   own folder. Open a terminal in that folder; no repository checkout is needed.
3. Run `npm install` (downloads the pinned Wrangler tool), then `npm run login`.
   Sign in to the Cloudflare account that owns the existing Worker.
4. Copy the exact Worker name from the dashboard and run:

   ```sh
   npm run deploy -- YOUR_EXISTING_WORKER_NAME
   ```

   Replace the uppercase placeholder. The helper requires an explicit name;
   it will not silently select a new one. Check Wrangler's account/name/domain
   output before accepting any update prompt. Use the existing Worker and keep
   its hostname and custom domain. Do not create a new site to fix this warning.
5. Open the existing address and accept the application's offered update on the
   locked screen. Enable Settings → Website icons → Download website icons if
   wanted; this remains optional and off by default.

`npm run check` validates a local dry-run bundle without deploying. `npm run dev`
runs a local Workers emulator, not your production site. Do not copy a real vault
into a test fixture. No Cloudflare credentials are included in this package.

## Layout and verification

- `public/`: exact static files from the verified Pages __VERSION__ release,
  including `_headers`. No Pages `_routes.json` or `_worker.js` is uploaded as
  a public static asset.
- `worker/index.js`: the exact released endpoint module, explicitly selected by
  `wrangler.json`, using the configured `ASSETS` binding.
- `run_worker_first: ["/api/favicon"]`: the API reaches the handler even when SPA
  navigation fallback applies; shell/assets use normal static serving/headers.
- Observability is disabled in the supplied configuration. No analytics or
  vault-data upload is added. The deployment replaces Worker code/assets and
  applies this configuration; if you have added other bindings, routes or
  triggers, merge those settings into `wrangler.json` before deploying.

After publishing, confirm CSP and security headers on `/`, JavaScript and `sw.js`;
`sw.js` must revalidate. `GET /api/favicon` must return 405, `Allow: POST`, and
`Cache-Control: no-store`, not HTML. Enable icon downloads and verify one site
icon separately: the method check alone does not prove upstream connectivity.
Offline unlocking and already cached icons should work after the shell updates.
Do not clear browser site data to force an update.

Only the local emulator/dry run can be verified without access to the owner's
Cloudflare account. This package does not itself establish a live deployment.

Sources:
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- https://developers.cloudflare.com/workers/static-assets/headers/
