# Working on PassKey Local

- Everything in the repository is written in English: code, comments, commits, PRs, docs.
- The specification lives in `docs/spec/` (start with `docs/spec/README.md`). MUST/MUST NOT are
  release requirements. Never weaken the KDBX profile, remove independent recovery, silently drop
  history, or mark unexecuted tests as passed.
- `docs/RELEASE_EVIDENCE.md` is the gate ledger. Update it in the same change that adds or runs a test.
- Browser side: `packages/vault-adapter` (TypeScript, strip-types compatible: no enums, no parameter
  properties). Always obtain kdbxweb through `kdbx()` so the integration hooks are installed.
- `packages/vault-core` persists only ciphertext and opaque metadata in IndexedDB. Commits are one
  short readwrite transaction with a generation compare-and-swap; never await crypto inside a
  transaction, never delete the database or clear a store.
- Python side: `tools/vault-recovery` must stay independent of the browser code (no shared crypto,
  no JavaScript runtime). Keep `export.py` and `recovery-model.ts` equivalent; the interop tests
  compare them.
- Only synthetic data in tests and fixtures.

Commands:

```sh
npm ci && npm run typecheck && npm test
cd tools/vault-recovery && python -m pytest
node tests/interop/generate-fixtures.ts   # regenerate the corpus after format-relevant changes
```
