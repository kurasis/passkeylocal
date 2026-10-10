# Vendored Vercel Web Design Guidelines skill

## Source and provenance

- Upstream repository: https://github.com/vercel-labs/agent-skills
- Upstream directory: `skills/web-design-guidelines/`
- Requested source: https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
- Pinned commit: `063bee94c3f4df8453406c830b0a7df0f2860278`
- Immutable source: https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278/skills/web-design-guidelines
- Copied on: 2026-10-10.

The complete upstream directory at this commit contains **only `SKILL.md`**.
It is copied byte for byte as a regular file; no auxiliary files or symlinks
exist in that directory. This README is local provenance documentation and is
not part of the upstream skill. Keep upstream instructions unmodified.

| Upstream file | Git blob SHA-1 | SHA-256 |
| --- | --- | --- |
| `SKILL.md` | `ceae92ab319216a68274168fba9b63b998b65997` | `f4647ca866a3accf763777f83e7682954f0187cd6bea7eea0399796652414e8f` |

## Use in this repository

Read [SKILL.md](SKILL.md) and follow the repository's [AGENTS.md](../../../AGENTS.md).
Apply the skill to changed web interface files, and explicitly use it for UI,
UX and accessibility audits. It requests fresh rules before **every review**;
this pinned skill does not freeze the rules themselves. Use the available
HTTPS fetch tool if the agent does not expose a tool named `WebFetch`.

Current rules URL:
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Availability was checked with an HTTPS GET on 2026-10-10: **HTTP 200**,
8,055 bytes; SHA-256 `d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`.
This records connectivity and the returned bytes, not an audit of this application's UI.
Future reviews must fetch the URL again. Do not substitute this recorded hash
for the current rules or claim compliance when fetching fails.

For restricted network environments, allow `raw.githubusercontent.com` for
rule fetching and pinned file downloads. Also allow `github.com` for Git
checkout and source links, and `api.github.com` for commit/tree enumeration.
No extra network configuration was needed for this installation.

## Reproduce or update

Use a temporary checkout of upstream; do not install into a container home
folder. To reproduce this version:

```sh
upstream_dir="$(mktemp -d /tmp/vercel-agent-skills.XXXXXX)"
git clone https://github.com/vercel-labs/agent-skills.git "$upstream_dir"
git -C "$upstream_dir" checkout --detach 063bee94c3f4df8453406c830b0a7df0f2860278
git -C "$upstream_dir" rev-parse HEAD
git -C "$upstream_dir" ls-tree -r HEAD -- skills/web-design-guidelines/
cp "$upstream_dir/skills/web-design-guidelines/SKILL.md" .agents/skills/web-design-guidelines/SKILL.md
sha256sum .agents/skills/web-design-guidelines/SKILL.md
```

Run these commands from this repository's root, using the environment's
existing Git authentication where required. Check the printed SHA and file
hash against this README.

For an update:

1. Resolve the desired upstream revision to a full commit SHA and check it out.
2. Enumerate the **entire** upstream skill directory, including hidden files,
   nested directories and Git file modes. Inspect any symlinks before copying;
   the vendored result must consist of regular files and directories.
3. Copy all upstream files byte for byte, preserving executable modes where
   present. Remove only stale files from the previous upstream manifest; keep
   this local README. If upstream adds its own `README.md`, preserve that file
   and move these local notes to `README.provenance.md`.
4. Update the pinned SHA, immutable source link, date and complete file/hash
   manifest here. Preserve root `AGENTS.md` and existing project instructions.
5. Verify frontmatter (`name`, `description`, `metadata`), relative references,
   file completeness and the absence of symlinks. Fetch the current rules URL
   and record the actual HTTP result; if blocked, report the required domains.
6. Review the Git diff, commit the documentation/skill changes and prepare a PR.
   Installing or updating this skill does not require application code changes.
