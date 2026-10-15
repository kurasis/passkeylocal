"""Create a dashboard static-only ZIP from the verified 0.1.2 Pages release."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent
version = json.loads((root / '../../apps/pwa/package.json').read_text())['version']
source = root / f'../cloudflare-pages/passkeylocal-cloudflare-pages-{version}.zip'
expected = Path(str(source) + '.sha256').read_text().split()[0]
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected
output = root / f'passkeylocal-cloudflare-workers-static-{version}.zip'
with zipfile.ZipFile(source) as original, zipfile.ZipFile(
    output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9
) as target:
    assert original.testzip() is None
    for name in sorted(original.namelist()):
        if name in {'_worker.js', '_routes.json'}:
            continue
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 15, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        target.writestr(info, original.read(name))
digest = hashlib.sha256(output.read_bytes()).hexdigest()
Path(str(output) + '.sha256').write_text(f'{digest}  {output.name}\n')
print(f'{output.name}: {output.stat().st_size} bytes; SHA-256 {digest}')
