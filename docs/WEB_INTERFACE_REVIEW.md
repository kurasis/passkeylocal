# Web interface audit remediation

Reviewed on 2026-10-10 using the repository-local
[web-design-guidelines skill](../.agents/skills/web-design-guidelines/SKILL.md).
Current rules were fetched successfully (HTTP 200) from
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md.
Rules SHA-256: `d246b026f4f29b5823a9cc857f9edf3d2507002e055e32040cadeaf3b38e0234`.

Scope: shared Passwords and File Safe interface, navigation, editing, forms,
dialogs, notifications, themes and virtual explorer. This is a UI review;
synthetic browser doubles do not establish Windows Hello hardware behavior.

| Original finding | Resolution | Evidence |
| --- | --- | --- |
| Switching password sections discards an entry draft | Registered RAM-only draft guards; confirm before section/module changes, browser Back, and page unload | Production draft navigation browser test |
| Desktop close dialog lacks modality/focus protection | Native modal dialog makes the background inert; explicit Tab wrap, cancellation focus return, save/discard/cancel | Desktop close browser test |
| Main content has no skip link | Focusable main with localized skip link and visible keyboard focus | Shared shell markup |
| Sections have no browser navigation | Real section links, public hash routes, Back/Forward; private routes have only opaque history keys | Navigation unit tests and production browser test |
| Folder dialogs do not constrain/restore focus | Shared modal, inert background, safe Cancel focus for deletion, Escape cancellation | Native folder modal browser test |
| Errors/cancellation look like saved success | Error alerts, cancellation warnings, transient success; errors and cancellation persist | Persistent feedback browser test |
| Closing file metadata discards a draft | Confirm close, location changes, sorting/search, pagination and module switching; successful save clears the guard | File metadata browser test |
| Version restoration happens immediately | Explicit confirmation before restoration; current data stays versioned | Version restoration browser test |
| Version dates and sizes are raw | Localized date and number formatting, nonbreaking units, BigInt-safe sizes | Version/history and explorer browser tests |
| Scrolling unmounts the focused virtual row | Pin one focused row outside the visible window; Arrow/Home/End navigate all rows | Virtual table focus browser test; at most 25 mounted rows |
| Explorer columns are not associated with data | Native table, scoped column headers, sort semantics, logical row counts/indexes | Table semantics browser test |
| Large password lists render without containment | Content visibility with intrinsic size; focused entries remain visible | Shared list styles and existing entry browser tests |
| Search errors appear as empty search results | Announced search failure and clear recovery instruction; clearing a query clears the error | Search failure browser test |
| Invalid creation does not focus/describe errors | Focus first invalid input, inline alert, aria-invalid and aria-describedby | Production creation validation browser test |
| Mobile inputs autofocus | Autofocus is limited to a fine primary pointer | Touch-device production browser test |
| Shared text fields have no meaningful names | Required TextField name, explicit editor and search/filter field names | Typecheck and browser forms |
| Dark destructive menu text has low contrast | Dedicated destructive text color; test all palettes at 4.5:1 or greater | Contrast browser test |
| Modals permit scroll chaining | Overscroll containment on dialogs, preview, text viewer, menu and theme popover | Folder modal browser test and styles |
| Browser theme color stays fixed | Update theme-color for explicit palettes and system scheme changes | Production three-palette browser test |

## Private navigation boundary

Only fixed module and section tokens may enter a URL. Entry IDs, titles,
usernames, passwords, folder IDs/names, searches, tags, notes and drafts stay
out of serialized history and persistent storage. Private view routes remain
in a bounded RAM map; lock rotates its namespace and clears it. Reload and
unknown history entries resolve to a public section, never a private detail.
This intentionally limits deep links for confidential vault content.

Locking does not wait for draft confirmation. Before-unload confirmation is
browser-dependent; passwords and file metadata are never autosaved in plaintext.

See [the release ledger](RELEASE_EVIDENCE.md) for executed validation and
publication status.
