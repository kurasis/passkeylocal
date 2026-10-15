"""Package the current production PWA, with a versioned filename and checksum."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent
app = root / '../../apps/pwa'
version = json.loads((app / 'package.json').read_text())['version']
dist = app / 'dist'
assert f'const VERSION = "{version}-' in (dist / 'sw.js').read_text()
assert (dist / '_worker.js').is_file()
assert json.loads((dist / '_routes.json').read_text()) == {
    'version': 1, 'include': ['/api/favicon'], 'exclude': []
}
archive = root / f'passkeylocal-cloudflare-pages-{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for file in sorted(dist.rglob('*')):
        if not file.is_file():
            continue
        info = zipfile.ZipInfo(file.relative_to(dist).as_posix(), date_time=(2026, 10, 15, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, file.read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
Path(str(archive) + '.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {archive.stat().st_size} bytes; SHA-256 {digest}')
