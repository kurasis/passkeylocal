# Agent instructions for PassKey Local

Read and follow [CLAUDE.md](CLAUDE.md) for existing project instructions,
including English repository content, specification requirements, independent
recovery, synthetic test data and honest release evidence. Start project
specification reading at [docs/spec/README.md](docs/spec/README.md).

## Web interface reviews

- When developing or changing the web interface, use the repository-local
  **web-design-guidelines** skill to check the result. Read
  [.agents/skills/web-design-guidelines/SKILL.md](.agents/skills/web-design-guidelines/SKILL.md)
  and apply it to the affected interface files before completing the task.
- For requests to audit UI, UX or accessibility, explicitly state that you are
  using **web-design-guidelines** and apply the skill to the requested scope.
- Follow the skill's instruction to fetch current rules before every review
  from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md.
  Use an available HTTPS fetch tool if `WebFetch` is not available. If fetching
  fails, report the limitation and domains that need access; do not claim the
  guideline review was completed.
- Preserve original upstream skill instructions. Source, pinned revision and
  update instructions are recorded in
  [.agents/skills/web-design-guidelines/README.md](.agents/skills/web-design-guidelines/README.md).

## Release versions and download handoffs

- Include the application version in every distribution archive, installer, CI
  artifact name, release title/tag and user-facing download handoff. Always state
  the version when giving the owner a build link. This is an explicit owner preference.
- Increase the application version for a new release. Keep PWA/desktop package
  versions, Tauri/Cargo versions, window title and installer metadata synchronized;
  use `node apps/desktop/scripts/check-version.mjs` before packaging. Do not change
  vault formats or stable application/data-directory identifiers for a version bump.
- Show the public application/version only in the window title, in the form
  `PassKey Local (0.1.2)`; never include vault names, entry data or file paths.
