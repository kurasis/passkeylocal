"""Publish verified versioned artifacts; never execute downloaded binaries."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile


def run(*args, **kwargs):
    return subprocess.check_output(args, text=True, **kwargs).strip()


REPO = os.environ["GITHUB_REPOSITORY"]
VERSION = os.environ["RELEASE_VERSION"]
if not re.fullmatch(r"\d+\.\d+\.\d+", VERSION):
    raise ValueError("Invalid release version")
if os.environ["GITHUB_REF"] != "refs/heads/main":
    raise ValueError("Publication is restricted to trusted main")
TAG = f"desktop-v{VERSION}"
OUT = Path("release-output")


def api(path, payload=None):
    args = ["gh", "api", f"repos/{REPO}/{path}"]
    if payload is None:
        return json.loads(run(*args))
    result = subprocess.check_output(
        [*args, "--method", "PATCH", "--input", "-"],
        input=json.dumps(payload), text=True,
    )
    return json.loads(result)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def roots(commit):
    tree = api(f"git/commits/{commit}")["tree"]["sha"]
    return {item["path"]: item["sha"] for item in api(f"git/trees/{tree}")["tree"]}


def prepare():
    run_id = os.environ["WINDOWS_RUN_ID"]
    if not re.fullmatch(r"\d+", run_id):
        raise ValueError("Invalid Windows run ID")
    current = run("git", "rev-parse", "HEAD")
    if run("node", "apps/desktop/scripts/check-version.mjs") != VERSION:
        raise ValueError("Requested release version differs from main")
    ci = api(f"actions/runs/{run_id}")
    if ci["conclusion"] != "success" or ci["path"] != ".github/workflows/windows.yml":
        raise ValueError("A successful original Windows workflow is required")
    if ci["event"] not in ("push", "pull_request", "workflow_dispatch"):
        raise ValueError("Unsupported source event")
    if ci["head_repository"]["full_name"] != REPO:
        raise ValueError("Fork artifacts cannot be published")
    run("git", "merge-base", "--is-ancestor", ci["head_sha"], current)
    artifacts = api(f"actions/runs/{run_id}/artifacts")["artifacts"]
    candidates = [a for a in artifacts if a["name"].startswith(f"PassKey-Local-Windows-x64-{VERSION}-") and not a["expired"]]
    if len(candidates) != 1:
        raise ValueError("Expected one versioned Windows artifact")
    native = Path("native-artifact")
    run("gh", "run", "download", run_id, "--repo", REPO, "--name", candidates[0]["name"], "--dir", str(native))
    build = json.loads((native / "build.json").read_text(encoding="utf-8-sig"))
    smoke = json.loads((native / "packaged-smoke.json").read_text(encoding="utf-8-sig"))
    if build["version"] != VERSION or smoke["version"] != VERSION or smoke["status"] != "PASS":
        raise ValueError("Version or installed smoke mismatch")
    if smoke["windowTitle"] != f"PassKey Local ({VERSION})" or smoke["sourceCommit"] != build["sourceCommit"]:
        raise ValueError("Installed title/source mismatch")
    source = build["sourceCommit"]
    if not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Invalid tested source")
    tested, target = roots(source), roots(current)
    for name in ("apps", "packages", "package-lock.json"):
        if tested[name] != target[name]:
            raise ValueError(f"Main application differs from tested source: {name}")
    installer = native / f"PassKey-Local-Windows-x64-{VERSION}-unsigned-setup.exe"
    installer_sha = digest(installer)
    if installer_sha != build["sha256"] or installer_sha != installer.with_suffix(".exe.sha256").read_text().split()[0]:
        raise ValueError("Installer checksum mismatch")
    OUT.mkdir(exist_ok=True)
    windows_zip = OUT / f"PassKey-Local-Windows-x64-{VERSION}-unsigned.zip"
    with zipfile.ZipFile(windows_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted(native.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(native))
    run("npm", "ci")
    run("npm", "run", "build", "-w", "@passkey-local/pwa")
    web_zip = OUT / f"passkeylocal-cloudflare-pages-{VERSION}.zip"
    web = Path("apps/pwa/dist")
    with zipfile.ZipFile(web_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(web.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(web))
    files = []
    for path in (windows_zip, web_zip):
        with zipfile.ZipFile(path) as archive:
            if archive.testzip() is not None:
                raise ValueError("Corrupt release archive")
        sha = digest(path)
        sidecar = path.with_suffix(".zip.sha256")
        sidecar.write_text(f"{sha}  {path.name}\n")
        for asset in (path, sidecar):
            files.append({"name": asset.name, "sha256": digest(asset), "bytes": asset.stat().st_size})
    manifest = OUT / f"release-{VERSION}.json"
    manifest.write_text(json.dumps({"version": VERSION, "targetCommit": current, "testedSource": source, "windowsRun": run_id, "installerSha256": installer_sha, "files": files}, indent=2) + "\n")
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        output.write(f"manifest_sha={digest(manifest)}\ntarget_sha={current}\n")


def publish():
    manifest_path = OUT / f"release-{VERSION}.json"
    if digest(manifest_path) != os.environ["MANIFEST_SHA"]:
        raise ValueError("Prepared manifest digest mismatch")
    manifest = json.loads(manifest_path.read_text())
    if manifest["version"] != VERSION or manifest["targetCommit"] != os.environ["TARGET_SHA"]:
        raise ValueError("Prepared release identity mismatch")
    expected = {manifest_path.name}
    for item in manifest["files"]:
        name = item["name"]
        if Path(name).name != name or VERSION not in name:
            raise ValueError("Unsafe or unversioned asset name")
        path = OUT / name
        if digest(path) != item["sha256"] or path.stat().st_size != item["bytes"]:
            raise ValueError("Prepared asset digest mismatch")
        expected.add(name)
    if {p.name for p in OUT.iterdir()} != expected:
        raise ValueError("Unexpected publication files")
    existing = [r for r in api("releases?per_page=100") if r["tag_name"] == TAG]
    if existing and not existing[0]["draft"]:
        raise ValueError("Never overwrite a published release")
    notes = Path("release-notes.md")
    notes.write_text(f"""Version **{VERSION}**. Native/document title: `PassKey Local ({VERSION})`.

Includes all previous UI audit fixes, draft protection, File Safe explorer/TXT preview and optional Windows Hello integration. Stable application identifiers and encrypted formats are unchanged.

Windows x64 archive: `PassKey-Local-Windows-x64-{VERSION}-unsigned.zip`.
Cloudflare Pages archive: `passkeylocal-cloudflare-pages-{VERSION}.zip`; upload separately, no server deployment was performed.

Experimental unsigned Windows build with official bundled WebView2 runtime. Successful installed-app verification and source/hash provenance: run {manifest['windowsRun']}, tested source `{manifest['testedSource']}`. See original JSON reports inside the Windows archive for hosted-runner evidence and remaining physical/standard-user/offline acceptance limits. SHA-256 files accompany both archives.
""")
    if not existing:
        run("gh", "release", "create", TAG, "--repo", REPO, "--draft", "--prerelease", "--latest=false", "--target", manifest["targetCommit"], "--title", f"PassKey Local {VERSION}", "--notes-file", str(notes))
        existing = [r for r in api("releases?per_page=100") if r["tag_name"] == TAG]
    release_id = existing[0]["id"]
    api(f"releases/{release_id}", {"target_commitish": manifest["targetCommit"], "body": notes.read_text(), "name": f"PassKey Local {VERSION}", "make_latest": "false"})
    run("gh", "release", "upload", TAG, "--repo", REPO, "--clobber", *[str(OUT / name) for name in sorted(expected)])
    uploaded = api(f"releases/{release_id}/assets")
    if {a["name"] for a in uploaded} != expected:
        raise ValueError("Release upload is incomplete; keeping draft")
    for asset in uploaded:
        path = OUT / asset["name"]
        if asset["state"] != "uploaded" or asset["size"] != path.stat().st_size:
            raise ValueError("Release upload size mismatch")
        if asset.get("digest") and asset["digest"] != f"sha256:{digest(path)}":
            raise ValueError("Release upload digest mismatch")
    published = api(f"releases/{release_id}", {"draft": False, "prerelease": True, "make_latest": "false"})
    print(published["html_url"])


if __name__ == "__main__":
    {"prepare": prepare, "publish": publish}[sys.argv[1]]()
