# Deploy application 0.1.2 using only the browser

No Node.js, terminal or Wrangler installation is required on the owner's PC.
Do not install anything on the running website either. Cloudflare can run the
deployment tools in its own build environment.

## Static ZIP: the existing upload screen

[Download the static-only application 0.1.2 ZIP](https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-workers/passkeylocal-cloudflare-workers-static-0.1.2.zip).

225,756 bytes; SHA-256
`12892c19072685cb126aeb6a9e80e53b113c608b358f6adc3bb04459bf62a7c5`.

On **Upload static files to update your Worker**, choose **Remove all**, upload
this ZIP, then deploy. If the uploader requests a folder, extract the ZIP and
select the folder containing `index.html`. Keep the current Worker and address.
This package contains only the ten released static files, including `_headers`;
no `_routes.json`, `_worker.js`, deployment tools or source maps.

**This is a static-only package. It cannot install the new favicon endpoint.**
The vault, offline shell and locally cached icons remain available. Unless the
host already has a working `/api/favicon` handler, downloading new icons falls
back to initials. Do not use this method expecting to enable new icon downloads.
It is not a substitute for the complete deployment below. Dashboard acceptance
and behavior on the owner's account still require the owner's upload.

## Complete app including icons: Cloudflare builds from GitHub

Use this method to keep icon downloads without installing local programs:

1. Open the **existing Worker**, then **Settings → Build**. Connect GitHub and
   select repository `kurasis/passkeylocal`, production branch `main`.
2. Enter these fields in Cloudflare's build settings (these are remote build
   settings, not commands to run on your PC):

   | Field | Value |
   | --- | --- |
   | Root directory | `deploy/cloudflare-workers` |
   | Build command | `python -m zipfile -e passkeylocal-cloudflare-workers-0.1.2.zip build` |
   | Deploy command | `npx --yes wrangler@4.151.0 deploy --config build/wrangler.json --name YOUR_EXISTING_WORKER_NAME --keep-vars` |

   Replace `YOUR_EXISTING_WORKER_NAME` with the exact name of the Worker you
   opened, not its domain or URL. Use the complete Workers archive in the build
   command, **not** the `workers-static` ZIP. Cloudflare's documented build image
   includes Python, Node.js and npm. Cloudflare handles deployment authentication;
   no credentials should be pasted into the repository or chat.
3. For this existing production site, disable builds for non-production branches
   until a separate preview configuration is set up. Do not reuse the production
   deploy command as a preview command.
4. Save and trigger **Build/Deploy**. Check the build log and final Worker name.
   Keep the current hostname/custom domain. If the Worker has other bindings,
   routes or triggers, merge that configuration before deploying this package;
   it is prepared for the static application shown in the owner's screenshot.
5. Open the current site and apply its offered app update from the locked screen.
   Do not clear browser site data. Enable the optional icon setting and test a
   site icon. Verify that `GET /api/favicon` returns 405 with `Allow: POST`, not
   the app HTML. A method response alone does not prove upstream icon retrieval.

Export and verify an encrypted backup before updating. GitHub connection and
Cloudflare account actions must be performed by the owner in their browser;
this repository does not claim they were performed. The exact extraction and
Wrangler dry-run can be checked locally without a production deployment.

Sources:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
