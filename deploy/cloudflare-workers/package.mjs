/** Repackage a verified Pages release for Workers without rebuilding application bytes. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('./', import.meta.url));
const version = JSON.parse(readFileSync(new URL('../../apps/pwa/package.json', import.meta.url))).version;
assert.match(version, /^\d+\.\d+\.\d+$/);
const archive = `passkeylocal-cloudflare-workers-${version}.zip`;
const input = fileURLToPath(new URL(`../cloudflare-pages/passkeylocal-cloudflare-pages-${version}.zip`, import.meta.url));
const expected = readFileSync(`${input}.sha256`, 'utf8').trim().split(/\s+/)[0];
assert.equal(createHash('sha256').update(readFileSync(input)).digest('hex'), expected);
const output = `${root}build`;
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
// Python's standard ZIP implementation keeps packaging independent of app dependencies.
const unpack = spawnSync('python', ['-c', `
import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[2])
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None
    for name in z.namelist():
        p=pathlib.PurePosixPath(name)
        assert not p.is_absolute() and '..' not in p.parts
        if name == '_routes.json': continue
        target=root/('worker/index.js' if name == '_worker.js' else 'public/'+name)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(z.read(name))
`, input, output], { stdio: 'inherit' });
assert.equal(unpack.status, 0);
writeFileSync(`${output}/wrangler.json`, JSON.stringify({
  main: 'worker/index.js', compatibility_date: '2026-10-15',
  assets: { directory: './public', binding: 'ASSETS',
    not_found_handling: 'single-page-application', run_worker_first: ['/api/favicon'] },
  observability: { enabled: false }, upload_source_maps: false
}, null, 2) + '\n');
writeFileSync(`${output}/package.json`, JSON.stringify({
  name: 'passkey-local-cloudflare-workers', private: true, version, type: 'module',
  scripts: { login: 'wrangler login', deploy: 'node deploy.mjs', dev: 'wrangler dev',
    check: 'wrangler deploy --dry-run --name passkey-local-local-check --outdir .check' },
  devDependencies: { wrangler: '4.151.0' }, engines: { node: '>=22.0.0' }
}, null, 2) + '\n');
writeFileSync(`${output}/deploy.mjs`, `import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const args = process.argv.slice(2);
if (args.length !== 1 || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(args[0]) || /YOUR|replace/i.test(args[0])) {
  console.error('Usage: npm run deploy -- EXISTING_WORKER_NAME (copy its exact name from Cloudflare).');
  process.exit(1);
}
const cli = new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url);
const result = spawnSync(process.execPath, [fileURLToPath(cli), 'deploy', '--name', args[0], '--keep-vars'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
`);
writeFileSync(`${output}/README.md`, readFileSync(`${root}UPLOAD.md`, 'utf8').replaceAll('__VERSION__', version));
writeFileSync(`${output}/source.json`, JSON.stringify({ version,
  source: `https://github.com/kurasis/passkeylocal/raw/refs/heads/main/deploy/cloudflare-pages/passkeylocal-cloudflare-pages-${version}.zip`,
  pagesSha256: expected, wranglerVersion: '4.151.0',
  applicationBytes: 'unchanged; only Pages deployment layout converted to Workers'
}, null, 2) + '\n');
const pack = spawnSync('python', ['-c', `
import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(root.rglob('*')):
        if p.is_file():
            info=zipfile.ZipInfo(p.relative_to(root).as_posix(),date_time=(2026,10,15,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            info.external_attr=0o100644<<16
            z.writestr(info,p.read_bytes())
`, output, `${root}${archive}`], { stdio: 'inherit' });
assert.equal(pack.status, 0);
const digest = createHash('sha256').update(readFileSync(`${root}${archive}`)).digest('hex');
writeFileSync(`${root}${archive}.sha256`, `${digest}  ${archive}\n`);
console.log(`${archive}: ${readFileSync(`${root}${archive}`).length} bytes, SHA-256 ${digest}`);
