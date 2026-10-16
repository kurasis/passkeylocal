# Deploy application 0.1.8 using only the browser

No Node.js, terminal or Wrangler installation is required on the owner's PC.
Do not install anything on the running website either. Cloudflare can run the
deployment tools in its own build environment.

## Static ZIP: the existing upload screen

[Download the static-only application 0.1.8 ZIP](https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-workers/passkeylocal-cloudflare-workers-static-0.1.8.zip).

227,458 bytes; SHA-256
`a297f99699f9912d900cbdb771cfb99a3ec9b4ca908a049600e7942c975914fb`.

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

**Updating an existing 0.1.2 connection:** change only its **Build command** from
`python -m zipfile -e passkeylocal-cloudflare-workers-0.1.2.zip build` to
`node package.mjs`. Keep the existing deploy command, root and Worker name.
Save and trigger a new build. This selects the current version automatically;
the old command would keep deploying the old archive even after new commits.
Saving a changed build command does not replace the currently served deployment:
start a new production build or push the next commit to `main`, then verify the
served version before treating the change as published.

1. Open the **existing Worker**, then **Settings → Build**. Connect GitHub and
   select repository `kurasis/passkeylocal`, production branch `main`.
2. Enter these fields in Cloudflare's build settings (these are remote build
   settings, not commands to run on your PC):

   | Field | Value |
   | --- | --- |
   | Root directory | `deploy/cloudflare-workers` |
   | Build command | `node package.mjs` |
   | Deploy command | `npx --yes wrangler@4.151.0 deploy --config build/wrangler.json --name YOUR_EXISTING_WORKER_NAME --keep-vars` |

   Replace `YOUR_EXISTING_WORKER_NAME` with the exact name of the Worker you
   opened, not its domain or URL. The build command verifies and packages the
   latest versioned Pages
   archive from this repository; it selects the current application version
   automatically, rather than repeatedly extracting an old fixed-version ZIP.
   Cloudflare's documented build image
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
   From 0.1.4, **Check for updates** can request a fresh check. If the old cached
   interface lacks that control, use Ctrl+Shift+R in desktop Chrome/Edge once,
   or close all site/PWA windows and reopen; see [update recovery](../../docs/releases/0.1.4.md).
   Do not clear browser site data. Enable the optional icon setting and test a
   site icon. Verify that `GET /api/favicon` returns 405 with `Allow: POST`, not
   the app HTML. A method response alone does not prove upstream icon retrieval.

### First build after connecting GitHub

If the Builds page says **You can now push a commit to your Git repository to
start your first build**, the connection is saved but deployment has not started.
Push or merge the next change to the selected production branch (`main` here).
A change inside `deploy/cloudflare-workers` also matches a build watch filter
scoped to that root directory. Then open the new entry in **Builds → Production**
and read its build/deploy log. A connected repository or successful Git push is
not proof that the Cloudflare build or production deployment succeeded.

Export and verify an encrypted backup before updating. GitHub connection and
Cloudflare settings remain under the owner's account control. Executed hosted
builds and public endpoint/version checks are recorded separately in
[release evidence](../../docs/RELEASE_EVIDENCE.md); account connection or a build
status alone is not proof of display in a browser using an older offline shell.

Sources:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
