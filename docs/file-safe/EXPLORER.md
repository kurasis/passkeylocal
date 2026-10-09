# File Safe explorer

The unlocked safe now uses an explorer layout. Folders and files share a compact,
virtualized list with Name, Type, Size and Modified columns. Folders appear first;
they have no invented dates or byte sizes. File sizes use integer arithmetic and
retain the exact byte count in their tooltip, including values above 2^53.

Select a folder name to enter it. **Parent folder / Родительская папка** in the
toolbar or the **[..]** row moves up one level. **Back / Назад**, **Forward /
Вперёд** and any ancestor in **Current folder / Текущая папка** navigate within
the safe. The breadcrumb path is logical and never includes an import source or
Windows filesystem location. Keyboard users can activate folder buttons with
Enter and use Arrow/Home/End on the virtualized list.

**New folder / Новая папка** creates a child of the currently displayed folder.
Import also copies into that folder. Entering another folder resets search,
selection and both file/folder paging offsets. Changing the sort or search clears
the old selection/details. File pages remain bounded to 100 rows, child folders
to 200 per page, with separate controls when more folders exist. Only a small
visible window is rendered. History is bounded to 100 in-memory locations and is
discarded at lock; it is not a persisted recent-files list.

The Name column sorts names ascending. Size and Modified sort files descending,
as in the existing native query. On narrow screens some columns are hidden;
the sort selector keeps every sort available. Favorites and Recycle bin are
separate file views using the existing native filters. The desktop module switches share the top header; import/new-folder controls sit below the left places panel. Right-click a file/folder, or press Shift+F10/ContextMenu on its button, for actions. File actions include details, rename/move, favorite, history, acknowledged export and recycle/restore. Permanent deletion still requires its existing confirmation. Folder actions enter/create a child, rename or confirm removal of an empty folder; native checks refuse the root and any child/file, including recycled files. File details retain rename,
tags, notes, moving, versions and acknowledged plaintext export. No file is
executed or opened externally by folder/file navigation.

## Separate settings

Select **File-safe settings / Настройки сейфа** in the safe heading. This opens
a separate screen containing encrypted backup configuration/manual copies,
recovery, independent Windows Hello, password rotation and inactivity locking.
The explorer list/path are absent from that screen. **Back to files / К файлам**
returns to the same logical folder. Leaving settings clears unsubmitted passwords,
the restore candidate and its acknowledgment. A lock clears both screens' secrets,
metadata, path and history; unlocking starts at the root. Late metadata replies
cannot restore an old folder or session.

For Hello, open this settings screen, expand **Windows Hello for File Safe /
Windows Hello для файлового сейфа**, confirm the safe's own password and connect.
Its PRF/TPM protection and independent password recovery are unchanged; see
[the Hello guide](WINDOWS_HELLO.md). The portable encrypted format, storage engine,
storage schema and standalone recovery tool require no migration. The additional preview command accepts only opaque IDs and validated inert text; there is no general file/path permission.

## Validation scope

Six synthetic UI scenarios cover nested paths/history/parent/breadcrumbs, correct
folder creation, settings and password-field isolation, stale reply after lock,
205-folder bounded paging, Russian layouts in all three palettes, native sort
requests and exact large size metadata. Existing Hello, lock, metadata and PWA
scenarios are retained. The installed Windows smoke creates actual nested native
folders and exercises parent/history/breadcrumb navigation and the separate Hello
settings screen. Its original screenshot and source correlation are published
with the installer after CI passes.

The new text-only worker has separate [TXT isolation evidence](TXT_PREVIEW.md); the earlier navigation checks do not establish that boundary or new biometric acceptance. See
[release evidence](../RELEASE_EVIDENCE.md) and [the operating guide](OPERATING_GUIDE.md).

## Shared appearance and action feedback

The safe uses the password module's navigation, heading, form and button styles in all three themes. Imports and new folders remain on the left; safe settings remain separate. Generic action success, progress and errors appear beside the heading, with wrapping on narrow screens. Successful password/Hello admission and ordinary metadata loading show no save notice. Explicit creation or changes may show a result for six seconds; locking clears it immediately.
