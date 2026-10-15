"""Synthetic publisher regressions: never contact GitHub or execute payloads."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.parse


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.old_cwd = Path.cwd()
        self.addCleanup(os.chdir, self.old_cwd)
        source = Path(__file__).with_name("desktop-release.py").resolve()
        os.chdir(self.temp.name)
        env = patch.dict(os.environ, {"GITHUB_REPOSITORY": "synthetic/repo",
            "GITHUB_REF": "refs/heads/main", "RELEASE_VERSION": "9.9.9", "GH_TOKEN": "synthetic-never-sent"})
        env.start(); self.addCleanup(env.stop)
        spec = importlib.util.spec_from_file_location("synthetic_release", source)
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        m = self.module
        m.OUT.mkdir()
        paths = []
        for name in ["Windows-9.9.9.zip", "Pages-9.9.9.zip"]:
            p = m.OUT / name
            p.write_bytes(b"synthetic non-executable payload")
            sidecar = p.with_suffix(".zip.sha256")
            sidecar.write_text(f"{m.digest(p)}  {p.name}\n")
            paths.extend([p, sidecar])
        manifest = {"version": m.VERSION, "targetCommit": "a" * 40,
            "testedSource": "b" * 40, "windowsRun": "123", "files": [
                {"name": p.name, "sha256": m.digest(p), "bytes": p.stat().st_size} for p in paths]}
        self.manifest = m.OUT / "release-9.9.9.json"
        self.manifest.write_text(json.dumps(manifest))
        os.environ.update(MANIFEST_SHA=m.digest(self.manifest), TARGET_SHA=manifest["targetCommit"])
        self.uploaded = []
        self.calls = []
        self.patches = []

    def publish(self, initial):
        m = self.module
        draft = {"id": 42, "draft": True, "tag_name": "untagged-synthetic", "name": "PassKey Local 9.9.9"}

        def api(path, payload=None, *, method="PATCH"):
            self.calls.append((path, payload, method))
            if path == "releases?per_page=100":
                return initial
            if path == "releases":
                self.assertEqual(method, "POST")
                self.assertTrue(payload["draft"])
                self.assertEqual(payload["tag_name"], m.TAG)
                return draft.copy()  # Immediate lookup by tag would fail.
            if path == "releases/42/assets":
                return self.uploaded.copy()
            if path == "releases/42":
                self.patches.append(payload)
                return {"html_url": "https://github.com/synthetic/repo/releases/tag/desktop-v9.9.9"}
            self.fail(f"Unexpected synthetic API path: {path}")

        def upload(request, timeout):
            self.assertEqual(timeout, 600)
            parsed = urllib.parse.urlparse(request.full_url)
            self.assertEqual(parsed.hostname, "uploads.github.com")
            self.assertTrue(parsed.path.endswith("/releases/42/assets"))
            name = urllib.parse.parse_qs(parsed.query)["name"][0]
            data = request.data.read()
            self.assertEqual(int(request.headers["Content-length"]), len(data))
            asset = {"name": name, "size": len(data), "state": "uploaded",
                "digest": "sha256:" + hashlib.sha256(data).hexdigest()}
            self.uploaded.append(asset)
            return io.BytesIO(json.dumps(asset).encode())

        with patch.object(m, "api", side_effect=api), \
                patch.object(m, "run", side_effect=AssertionError("No legacy CLI release creation")), \
                patch.object(m.urllib.request, "urlopen", side_effect=upload), \
                contextlib.redirect_stdout(io.StringIO()):
            m.publish()

    def test_fresh_draft_uses_returned_id_even_if_its_tag_changes(self):
        self.publish([])
        self.assertEqual(sum(path == "releases?per_page=100" for path, _, _ in self.calls), 1)
        self.assertEqual(sum(method == "POST" for _, _, method in self.calls), 1)
        self.assertEqual(len(self.uploaded), 5)
        self.assertEqual(self.patches[-1], {"tag_name": self.module.TAG, "draft": False,
            "prerelease": True, "make_latest": "false"})

    def test_resumes_untagged_same_version_draft_without_creating_another(self):
        self.publish([{"id": 42, "draft": True, "tag_name": "untagged-existing", "name": "PassKey Local 9.9.9"}])
        self.assertFalse(any(method == "POST" for _, _, method in self.calls))
        self.assertEqual(len(self.uploaded), 5)

    def test_does_not_overwrite_a_published_version(self):
        with self.assertRaisesRegex(ValueError, "Never overwrite"):
            self.publish([{"id": 42, "draft": False, "tag_name": self.module.TAG, "name": "PassKey Local 9.9.9"}])
        self.assertEqual(self.uploaded, [])

    def test_rejects_changed_payload_before_any_github_write(self):
        (self.module.OUT / "Windows-9.9.9.zip").write_bytes(b"changed payload")
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            self.publish([])
        self.assertEqual(self.calls, [])

    def test_api_creates_with_structured_post_payload(self):
        with patch.object(self.module.subprocess, "check_output", return_value='{"id": 42}') as command:
            result = self.module.api("releases", {"draft": True}, method="POST")
        self.assertEqual(result, {"id": 42})
        args, kwargs = command.call_args
        self.assertIn("POST", args[0])
        self.assertEqual(json.loads(kwargs["input"]), {"draft": True})


if __name__ == "__main__":
    unittest.main()
