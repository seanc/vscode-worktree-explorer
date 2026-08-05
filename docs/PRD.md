# Worktree Explorer

## Product Requirements Document

| Field | Value |
|---|---|
| Product | Worktree Explorer |
| Product type | Visual Studio Code extension |
| Status | Draft for implementation |
| Version | 0.1 |
| Primary language | TypeScript |
| Primary platform | VS Code Desktop |
| Target users | Developers using Git linked worktrees |
| Core dependency | VS Code built-in Git extension |
| MVP scope | Local filesystem repositories and linked worktrees |

---

## 1. Executive summary

Worktree Explorer adds a secondary file explorer to Visual Studio Code for browsing and editing one Git linked worktree without adding that worktree to the VS Code workspace.

The extension contributes a native Tree View to the existing Explorer container. The view is bound to one selected linked worktree and supports:

- browsing files and folders;
- opening files in an editor;
- creating files and folders;
- renaming files and folders;
- deleting files and folders;
- manually switching the displayed worktree;
- following worktree selections made in the Source Control repositories view;
- handling multiple SCM-selected worktrees by displaying the most recently selected one.

The displayed worktree remains independent of `workspace.workspaceFolders`. The extension must not call `workspace.updateWorkspaceFolders` during normal operation.

This product is intentionally smaller than a second full VS Code workspace. It provides direct filesystem access and familiar Explorer interactions while avoiding changes to workspace configuration, tasks, searches, and extension project scopes.

---

## 2. Problem statement

Git worktrees allow several branches of one repository to be checked out simultaneously. VS Code can discover multiple repositories and linked worktrees in Source Control, but the built-in File Explorer remains tied to workspace folders.

To inspect another worktree, developers commonly have to:

1. add it as another workspace folder;
2. open another VS Code window;
3. browse through the operating system;
4. use terminal commands;
5. open individual files by absolute path.

These workarounds are inconvenient or change the behavior of the current workspace. Multi-root workspaces can affect search, tasks, language tooling, extension activation, and project configuration. Separate windows fragment context.

Worktree Explorer must make another worktree browsable and editable while leaving the current workspace unchanged.

---

## 3. Vision

Enable developers to inspect and make focused edits in any linked Git worktree from their current VS Code window through a native secondary explorer, without making the worktree part of the workspace.

---

## 4. Goals

### G-01 — Dedicated worktree explorer

Provide a native Tree View rooted at one linked Git worktree.

### G-02 — Workspace isolation

Never add the displayed worktree to `workspace.workspaceFolders` as part of normal extension behavior.

### G-03 — SCM synchronization

Follow linked-worktree selections made in the Source Control repositories view.

### G-04 — Manual selection

Allow the user to display any discovered linked worktree through a native searchable picker.

### G-05 — Multiple-selection handling

When multiple linked worktrees are SCM-selected, display the one that was selected most recently.

When selection order cannot be reconstructed, use a deterministic fallback.

### G-06 — Basic filesystem operations

Support opening, creating, renaming, and deleting files and directories inside the displayed worktree.

### G-07 — Root-boundary safety

Prevent all extension-initiated filesystem mutations from escaping the active worktree.

### G-08 — Native VS Code UX

Use Tree View, Quick Pick, commands, menus, dialogs, Theme Icons, and context keys rather than a webview-based file browser.

---

## 5. Non-goals

The MVP will not:

- replace the built-in File Explorer;
- add or remove workspace folders;
- create, move, prune, lock, or delete Git worktrees;
- provide staging, committing, merging, rebasing, or branch management;
- reproduce every built-in Explorer feature;
- provide copy/cut/paste;
- provide drag-and-drop;
- support multi-selection file operations;
- show Git status decorations;
- provide project-wide language-server guarantees for external files;
- provide a custom editor or terminal;
- support arbitrary non-Git directories;
- modify `.code-workspace` files;
- require or use a webview;
- collect telemetry.

---

## 6. Personas

### 6.1 Parallel feature developer

Works on several branches through linked worktrees and needs to inspect or edit files in another worktree without leaving the main workspace.

### 6.2 Code reviewer

Keeps review branches in separate worktrees and wants a visual file tree without opening a second window.

### 6.3 AI-assisted developer

Uses worktrees to isolate concurrent coding-agent tasks and needs to inspect generated changes across them.

### 6.4 Release maintainer

Maintains main, release, and hotfix worktrees and needs quick access to files in each.

---

## 7. Terminology

| Term | Meaning |
|---|---|
| Main repository | The primary repository or main working tree known to VS Code |
| Linked worktree | An additional working tree created with `git worktree add` |
| Active worktree | The linked worktree currently displayed by Worktree Explorer |
| SCM selection | Selection state in VS Code’s Source Control repositories UI |
| Manual selection | Selection made through Worktree Explorer’s picker |
| Secondary explorer | The custom Tree View contributed by this extension |
| Root boundary | The active worktree directory within which operations are allowed |
| Selection epoch | Monotonic counter used to track which worktree was selected most recently |
| Root generation | Monotonic token invalidating commands started against an old active root |

---

## 8. Product principles

1. **Workspace state is not worktree-view state.** Changing the displayed worktree must not change workspace folders.
2. **Filesystem state is authoritative.** The tree reflects disk contents, not an independent model.
3. **Automatic by default, manually controllable.** SCM selection drives the view, but the user can temporarily override it.
4. **Manual choice remains stable.** A manual choice remains active until SCM selection changes.
5. **Destructive actions are bounded and confirmed.**
6. **Use native VS Code controls.**
7. **Degrade clearly when Git integration is unavailable.**

---

## 9. Core user experience

### 9.1 Explorer placement

The extension contributes a view to the existing Explorer container:

```text
EXPLORER
├── Open Editors
├── Project
└── Worktree Explorer    feature/payments · payments-wt
    ├── src
    ├── tests
    ├── package.json
    └── README.md
```

### 9.2 Active-worktree indicator

The view description should display:

```text
<branch-or-ref> · <folder-name>
```

Examples:

```text
feature/payments · payments-wt
release/2.4 · release-2.4
detached@a8cf231 · investigation
```

### 9.3 Worktree selector

A primary view-title action named **Select Worktree** opens a Quick Pick containing all discovered linked worktrees.

Each item should show:

- branch, ref, or detached identifier;
- worktree folder name;
- complete path;
- owning repository when multiple unrelated repositories are open;
- active selection indicator;
- optional SCM-selected indicator.

### 9.4 Main repository selected

When the SCM selection contains no linked worktree and resolves to the main repository:

- hide the Worktree Explorer view;
- keep valid persistence state internally;
- do not clear the user’s previous worktree history unnecessarily.

### 9.5 One linked worktree selected

When one linked worktree becomes selected:

- show the view;
- make it active;
- update the description;
- refresh the tree;
- replace the filesystem watcher;
- clear any manual override;
- record the worktree’s latest selection epoch.

### 9.6 Multiple linked worktrees selected

When multiple linked worktrees are selected:

1. choose the one with the highest selection epoch;
2. display it;
3. keep the picker available for manual switching;
4. do not require SCM single-selection mode.

On activation, if no selection history exists, use:

1. repository ordering from the Git API;
2. normalized path ordering as the final fallback.

### 9.7 Main repository and linked worktrees selected together

When the main repository and one or more linked worktrees are selected:

- keep the Worktree Explorer visible;
- display the most recently selected linked worktree.

The view disappears only when no linked worktree is selected and the current SCM state resolves to the main repository.

### 9.8 Manual override

When the user chooses a worktree through the picker:

- switch immediately;
- set active source to `manual`;
- do not modify SCM selection;
- do not modify workspace folders;
- keep the manual worktree active while SCM selection remains unchanged.

When SCM selection changes:

- clear the manual override;
- synchronize to the latest selected linked worktree;
- hide the view if no linked worktree remains selected.

### 9.9 No linked worktrees

When none are available:

- hide the view;
- leave the Select Worktree command accessible from the Command Palette;
- show “No linked Git worktrees were found” when invoked.

### 9.10 Removed active worktree

If the active worktree disappears or is no longer reported by Git:

- dispose its watcher;
- invalidate its root generation;
- clear its nodes;
- select another valid SCM-selected worktree when available;
- otherwise hide the view;
- notify the user once.

### 9.11 Git extension unavailable

If the built-in Git extension is disabled or unavailable:

- hide the view;
- disable dependent commands;
- show a clear explanation if the user invokes a command;
- recover automatically if Git becomes available later.

---

## 10. Tree behavior

### 10.1 Lazy loading

Read a directory only when its node is expanded.

### 10.2 Sorting

Default order:

1. directories;
2. files;
3. case-insensitive locale-aware name;
4. URI as a stable tie-breaker.

Supported setting values:

- `foldersFirst`;
- `mixed`;
- `filesFirst`.

### 10.3 Hidden files

Show hidden files by default.

### 10.4 Exclusions

Support extension-specific glob exclusions without modifying global VS Code settings.

Default:

```json
{
  "**/.git": true,
  "**/node_modules": true
}
```

Git administrative paths must never receive destructive commands.

### 10.5 Symbolic links

- identify symbolic links distinctly;
- resolve their target before mutation;
- reject mutations when the resolved target is outside the active root;
- external links may be shown as read-only or non-expandable in MVP.

### 10.6 Opening files

Selecting or activating a file opens it through VS Code document APIs.

Opening a file must not add its directory to the workspace.

### 10.7 Refresh

Provide:

- automatic refresh from filesystem events;
- manual Refresh;
- Collapse All.

---

## 11. Filesystem operations

### FR-FILE-01 — Create file

The user can create a file at the root or within a selected directory.

Requirements:

- reject absolute paths;
- reject traversal outside the root;
- reject existing destinations;
- create an empty file;
- refresh the parent;
- open the new file;
- revalidate the current root generation before writing.

### FR-FILE-02 — Create directory

The user can create a directory within the active root.

Nested relative paths may be supported when every path component remains inside the root.

### FR-FILE-03 — Rename

The user can rename a file or directory.

Requirements:

- prohibit path separators in the new name for MVP;
- prohibit overwrite;
- preserve root containment;
- support case-only rename where the filesystem permits it;
- refresh affected nodes;
- reject stale commands.

### FR-FILE-04 — Delete

The user can delete a file or directory.

Requirements:

- confirm destructive operations;
- distinguish file and recursive directory deletion;
- use trash when configured and supported;
- prohibit active-root deletion;
- prohibit Git administrative-path deletion;
- revalidate immediately before deletion;
- abort if active root changed while confirmation was open.

### FR-FILE-05 — Shared boundary guard

Every mutation must pass through one shared root-boundary service that:

1. normalizes the root;
2. normalizes the candidate;
3. handles case sensitivity appropriately;
4. resolves symlinks where necessary;
5. confirms descendant relationship;
6. rejects the root for destructive operations;
7. rejects commands with an obsolete root generation.

### FR-FILE-06 — Concurrent changes

When another process modifies a target during an operation:

- report a concise actionable error;
- refresh the affected parent;
- do not automatically retry destructive actions.

---

## 12. Commands

| Command ID | Display name |
|---|---|
| `worktreeExplorer.selectWorktree` | Worktree Explorer: Select Worktree |
| `worktreeExplorer.refresh` | Worktree Explorer: Refresh |
| `worktreeExplorer.open` | Worktree Explorer: Open File |
| `worktreeExplorer.newFile` | Worktree Explorer: New File |
| `worktreeExplorer.newFolder` | Worktree Explorer: New Folder |
| `worktreeExplorer.rename` | Worktree Explorer: Rename |
| `worktreeExplorer.delete` | Worktree Explorer: Delete |
| `worktreeExplorer.copyRelativePath` | Worktree Explorer: Copy Relative Path |
| `worktreeExplorer.copyAbsolutePath` | Worktree Explorer: Copy Absolute Path |
| `worktreeExplorer.revealInOperatingSystem` | Worktree Explorer: Reveal in File Explorer |
| `worktreeExplorer.collapseAll` | Worktree Explorer: Collapse All |
| `worktreeExplorer.copyWorktreePath` | Worktree Explorer: Copy Worktree Path |
| `worktreeExplorer.revealWorktreeRoot` | Worktree Explorer: Reveal Worktree Root |

---

## 13. Menus

### 13.1 View-title actions

Primary:

- Select Worktree;
- Refresh;
- Collapse All.

Overflow:

- Copy Worktree Path;
- Reveal Worktree Root;
- Extension Settings.

### 13.2 File context menu

- Open;
- Rename;
- Delete;
- Copy Relative Path;
- Copy Absolute Path;
- Reveal in Operating System.

### 13.3 Directory context menu

- New File;
- New Folder;
- Rename;
- Delete;
- Refresh;
- Copy Relative Path;
- Copy Absolute Path;
- Reveal in Operating System.

---

## 14. Context keys

| Context key | Meaning |
|---|---|
| `worktreeExplorer.gitAvailable` | Built-in Git integration is available |
| `worktreeExplorer.hasWorktrees` | At least one linked worktree exists |
| `worktreeExplorer.visible` | The custom view should be visible |
| `worktreeExplorer.hasActiveRoot` | A valid worktree is active |
| `worktreeExplorer.activeSource` | `scm`, `manual`, or `restored` |
| `worktreeExplorer.itemType` | `file`, `folder`, `symlink`, or `root` |
| `worktreeExplorer.itemWritable` | The item permits mutation |
| `worktreeExplorer.workspaceTrusted` | Current trust state permits mutation |

Proposed view contribution:

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "id": "worktreeExplorer.files",
          "name": "Worktree Explorer",
          "when": "worktreeExplorer.visible"
        }
      ]
    }
  }
}
```

---

## 15. Selection model

### 15.1 State

```ts
type ActiveSelectionSource = 'scm' | 'manual' | 'restored';

interface WorktreeDescriptor {
  repositoryRoot: vscode.Uri;
  rootUri: vscode.Uri;
  displayName: string;
  ref?: string;
  isMain: boolean;
  isDetached: boolean;
}

interface SelectionState {
  activeWorktreeUri?: vscode.Uri;
  activeSource?: ActiveSelectionSource;
  selectionEpoch: number;
  scmSelected: Map<string, boolean>;
  lastSelectedEpoch: Map<string, number>;
  rootGeneration: number;
}
```

### 15.2 SCM transition handling

For every repository UI change:

1. compare current and previous selected state;
2. on `false → true`, increment the global selection epoch;
3. store the epoch for that worktree;
4. resolve the current selected linked worktrees;
5. apply selection precedence;
6. update active root only if it changed.

### 15.3 Resolution precedence

1. A newly changed SCM selection clears manual override.
2. If one or more linked worktrees are SCM-selected, use the selected worktree with the greatest epoch.
3. If no linked worktree is selected and the main repository is selected, hide the view.
4. If SCM selection is empty or ambiguous without a change event, preserve a valid manual/restored root according to settings.
5. If active root is invalid, clear it.

### 15.4 Persistence

Persist per workspace:

- last valid manual worktree URI;
- last active worktree URI;
- active source.

Do not persist selection epochs.

On activation:

1. discover repositories and worktrees;
2. inspect SCM selection;
3. prefer current SCM-selected linked worktrees;
4. otherwise restore the last valid selection when enabled;
5. otherwise hide the view.

---

## 16. Worktree discovery

### 16.1 Primary source

Use the built-in Git extension API through a dedicated adapter.

Consume only the minimum required concepts:

- repository list;
- repository open/close events;
- repository root URI;
- repository kind;
- repository UI selected state and change event;
- worktree metadata;
- Git enabled/disabled state.

### 16.2 Isolation requirement

All bundled Git API types and calls must remain behind `GitIntegrationService`.

No tree, filesystem, command, or persistence component may depend directly on Git API types.

### 16.3 Optional CLI fallback

A later fallback may run:

```bash
git worktree list --porcelain
```

for inventory only.

It cannot reproduce Source Control selection synchronization and is not required for MVP.

### 16.4 Multiple repositories

Group picker items by their owning repository when unrelated repositories are open.

---

## 17. Architecture

```text
┌─────────────────────────────┐
│ VS Code Built-in Git        │
│ repositories / selection    │
└──────────────┬──────────────┘
               v
┌─────────────────────────────┐
│ GitIntegrationService       │
│ discovery and normalization │
└──────────────┬──────────────┘
               v
┌─────────────────────────────┐
│ SelectionCoordinator        │
│ SCM history / manual state  │
└───────┬─────────────┬───────┘
        │             │
        v             v
┌───────────────┐  ┌─────────────────┐
│ Tree Provider │  │ Context Keys    │
└───────┬───────┘  └─────────────────┘
        v
┌─────────────────────────────┐
│ FileSystemService           │
│ list / mutate / guard       │
└──────────────┬──────────────┘
               v
┌─────────────────────────────┐
│ WorktreeWatcher             │
│ one active-root watcher     │
└─────────────────────────────┘
```

### 17.1 Components

#### `GitIntegrationService`

- activates the built-in Git extension;
- discovers repositories and worktrees;
- normalizes Git data;
- observes selection and repository lifecycle;
- exposes Git availability.

#### `SelectionCoordinator`

- tracks selection epochs;
- implements manual override;
- resolves view visibility;
- increments root generation;
- persists and restores valid selection state.

#### `WorktreeTreeProvider`

- lazily lists directories;
- creates stable Tree Items;
- applies sorting and exclusions;
- emits refresh events.

#### `FileSystemService`

- wraps `workspace.fs`;
- implements create, rename, and delete;
- converts errors into user-facing messages;
- delegates every mutation to the boundary guard.

#### `RootBoundaryGuard`

- normalizes paths;
- handles filesystem case behavior;
- resolves symlinks where required;
- validates root generation and containment.

#### `WorktreeWatcher`

- watches only the active root;
- coalesces rapid changes;
- disposes when root changes;
- requests full or parent-node refresh.

#### `ContextKeyController`

- updates view visibility;
- controls command/menu enablement;
- reflects item and trust state.

#### `PersistenceService`

- stores per-workspace valid selection state;
- removes stale roots.

---

## 18. Refresh strategy

- maintain at most one active-root watcher;
- use a URI-based relative pattern;
- debounce events for approximately 100–250 ms;
- allow full-tree refresh for MVP;
- retain manual Refresh as a fallback;
- measure large-tree behavior before release;
- optimize to affected-parent refresh if needed.

---

## 19. Configuration

```json
{
  "worktreeExplorer.followScmSelection": true,
  "worktreeExplorer.restoreLastSelection": true,
  "worktreeExplorer.showHiddenFiles": true,
  "worktreeExplorer.sortOrder": "foldersFirst",
  "worktreeExplorer.confirmDelete": true,
  "worktreeExplorer.useTrash": true,
  "worktreeExplorer.openFilesInPreview": true,
  "worktreeExplorer.exclude": {
    "**/.git": true,
    "**/node_modules": true
  }
}
```

### 19.1 `followScmSelection`

When false:

- SCM selection does not switch the tree;
- selection is manual/restored only;
- invalid active roots are still cleared.

### 19.2 `restoreLastSelection`

When true, restore the last valid worktree when no current linked-worktree SCM selection takes precedence.

### 19.3 `confirmDelete`

Default `true`.

Root and Git-administration protection cannot be disabled.

### 19.4 `useTrash`

Default `true`.

If trash is unavailable, require confirmation before permanent deletion.

---

## 20. Security and safety

### SEC-01 — Path traversal

Reject absolute names, URI injection, and `..` traversal escaping the root.

### SEC-02 — Symlink escape

Resolve link targets before mutations and reject targets outside the active root.

### SEC-03 — Stale command protection

Capture root generation when a command starts and revalidate immediately before mutation.

### SEC-04 — Workspace Trust

Browsing and opening may remain available in untrusted workspaces. Mutating commands should be disabled by default when the window is untrusted.

### SEC-05 — No shell interpolation

Do not implement file operations by constructing shell commands from paths.

### SEC-06 — Protected paths

Never mutate:

- active root;
- `.git`;
- worktree administration files;
- paths outside the active worktree.

### SEC-07 — Delete confirmation

Display item name, type, relative path, and owning worktree.

---

## 21. Privacy

MVP contains no telemetry and sends no data externally.

It must not transmit:

- repository paths;
- filenames;
- branch names;
- remotes;
- file contents;
- worktree metadata.

---

## 22. Accessibility

- support keyboard navigation;
- use native controls;
- provide accessible labels for title actions and nodes;
- do not rely on color alone;
- make active, detached, and selected states available as text or accessible descriptions;
- provide command-palette access to primary actions.

---

## 23. Performance requirements

| Requirement | Target |
|---|---|
| Extension-owned synchronous activation with no active root | Under 100 ms |
| Active root switch | Under 250 ms in normal local repositories |
| Directory with fewer than 500 entries | Visible within 200 ms |
| Inactive worktree tree retention | None |
| Active watchers | One |
| External change refresh | Under 1 second in normal conditions |

Performance targets exclude slow disks, remote extension hosts, and operating-system watcher delays.

---

## 24. Compatibility

### Supported for MVP

- VS Code Desktop;
- Windows;
- macOS;
- Linux;
- local filesystem repositories;
- built-in Git extension enabled;
- linked worktrees detected by VS Code.

### Conditional

Remote Extension Host environments may work when both Git and Worktree Explorer run on the same side and the filesystem scheme supports required operations.

### Not supported for MVP

- vscode.dev;
- browser-only extension host;
- unsupported custom URI schemes;
- non-VS-Code IDEs;
- arbitrary folders outside Git worktree discovery.

---

## 25. Error handling

| Condition | User-facing message |
|---|---|
| Git unavailable | Worktree Explorer requires VS Code’s built-in Git extension. |
| No linked worktrees | No linked Git worktrees were found. |
| Active worktree removed | The selected worktree no longer exists. |
| Permission denied | Unable to modify this item because permission was denied. |
| Outside root | The operation was blocked because the target is outside the selected worktree. |
| Existing destination | A file or folder with this name already exists. |
| Stale command | The selected worktree changed before the operation completed. |
| Watcher failure | Automatic refresh is unavailable. Use Refresh to update the view. |

Unexpected failures go to an output channel named **Worktree Explorer**. File contents must never be logged.

---

## 26. Functional requirements catalogue

### Discovery

- **FR-001:** Detect linked worktrees for known repositories.
- **FR-002:** Distinguish main repositories from linked worktrees.
- **FR-003:** React to repositories/worktrees appearing and disappearing.
- **FR-004:** Support multiple unrelated repositories.

### Selection

- **FR-010:** Track current SCM-selected repositories.
- **FR-011:** Display one selected linked worktree automatically.
- **FR-012:** Resolve multiple selections using latest transition.
- **FR-013:** Apply deterministic activation fallback.
- **FR-014:** Remain visible when root and linked worktrees are selected together.
- **FR-015:** Hide when the main repository is selected without linked worktrees.
- **FR-016:** Support manual selection.
- **FR-017:** Preserve manual selection until SCM selection changes.
- **FR-018:** Allow disabling SCM following.

### Browsing

- **FR-020:** Display active-root descendants.
- **FR-021:** Lazy-load directories.
- **FR-022:** Sort deterministically.
- **FR-023:** Apply extension-specific exclusions.
- **FR-024:** Refresh after filesystem events.
- **FR-025:** Provide manual refresh.
- **FR-026:** Open files in editors.

### Mutations

- **FR-030:** Create files.
- **FR-031:** Create directories.
- **FR-032:** Rename files.
- **FR-033:** Rename directories.
- **FR-034:** Delete files.
- **FR-035:** Delete directories with recursive confirmation.
- **FR-036:** Copy relative paths.
- **FR-037:** Copy absolute paths.
- **FR-038:** Reveal resources in the operating system.

### Isolation and safety

- **FR-040:** Never add the active root to workspace folders.
- **FR-041:** Keep active root independent from workspace-folder commands.
- **FR-042:** Change root only through selection logic.
- **FR-043:** Prevent mutations outside the active root.
- **FR-044:** Reject stale operations after root changes.

### Persistence

- **FR-050:** Persist last valid manual selection per workspace.
- **FR-051:** Remove invalid persisted roots.
- **FR-052:** Do not persist multi-selection ordering as authoritative.

---

## 27. Acceptance criteria

### AC-01 — View visibility

Selecting a linked worktree in Source Control displays Worktree Explorer in the Explorer container.

### AC-02 — Main repository behavior

Selecting only the main repository hides Worktree Explorer.

### AC-03 — Multiple SCM selections

When several worktrees are selected, the one most recently selected is displayed.

### AC-04 — Manual override

A manually chosen worktree remains active until SCM selection changes.

### AC-05 — Workspace isolation

Opening and mutating files through Worktree Explorer does not modify:

- `workspace.workspaceFolders`;
- `.code-workspace`;
- multi-root workspace membership.

### AC-06 — Open file

Activating a file opens it in a VS Code editor.

### AC-07 — Create file

Creating a file writes it inside the active worktree, refreshes its parent, and opens it.

### AC-08 — Rename

Renaming changes the filesystem item without changing the active worktree.

### AC-09 — Delete

Confirmed deletion removes the item and refreshes the tree.

### AC-10 — Root protection

The active worktree root cannot be renamed or deleted.

### AC-11 — Traversal protection

Inputs such as `../../outside.txt` are rejected.

### AC-12 — Root switch

Switching roots disposes the old watcher, creates the new watcher, and invalidates stale commands.

### AC-13 — External changes

Files created or deleted by external processes appear without restarting VS Code.

### AC-14 — Removed worktree

Removing the active worktree clears it without retaining a dead root.

### AC-15 — Multiple repositories

Picker items are grouped by owning repository.

### AC-16 — Git unavailable

The view hides and commands fail with a clear explanation.

### AC-17 — Cross-platform

Automated tests pass on Windows, macOS, and Linux.

---

## 28. Testing strategy

### 28.1 Unit tests

Cover:

- selection epoch handling;
- manual override lifecycle;
- main versus linked resolution;
- deterministic fallback;
- URI/path normalization;
- root containment;
- case-sensitive and insensitive paths;
- symlink escape;
- stale root generation;
- sorting;
- exclusions;
- persistence validation.

### 28.2 VS Code integration tests

Create temporary Git fixtures for:

1. no linked worktrees;
2. one linked worktree;
3. three linked worktrees;
4. two unrelated repositories;
5. detached worktree;
6. removed active worktree;
7. nested directories and symlinks.

### 28.3 File-operation tests

Cover:

- create file;
- create nested directory;
- rename;
- case-only rename where supported;
- delete file;
- recursive directory delete;
- duplicate destination;
- permission failure;
- traversal rejection;
- root deletion rejection;
- symlink escape rejection;
- stale command rejection.

### 28.4 UI tests

Cover:

- view visibility;
- description;
- title actions;
- context-menu conditions;
- Quick Pick grouping;
- active indicator;
- keyboard activation;
- command enablement.

### 28.5 CI

Run on:

- Ubuntu;
- Windows;
- macOS.

---

## 29. Delivery milestones

### Milestone 0 — Technical feasibility

Confirm the Git API, view contribution, SCM selection tracking, root switching, and dynamic visibility.

### Milestone 1 — Read-only MVP

Deliver discovery, synchronization, picker, tree browsing, file opening, refresh, and workspace isolation.

### Milestone 2 — Safe file operations

Deliver boundary guard, create, rename, delete, path commands, and stale-operation protection.

### Milestone 3 — Hardening

Deliver persistence, multiple repositories, symlink handling, Workspace Trust, errors, performance work, and cross-platform tests.

### Milestone 4 — Release

Deliver documentation, icon, Marketplace metadata, packaging, release CI, and VSIX.

---

## 30. Success metrics

| Metric | Target |
|---|---|
| Workspace-folder mutations caused by extension | 0 |
| Operations escaping the active root | 0 |
| Worktree selection accuracy in tests | 100% |
| Root switches requiring VS Code reload | 0 |
| Cross-platform CI pass rate | 100% |
| Unhandled extension errors in test suite | 0 |
| External refresh under normal conditions | Under 1 second |

---

## 31. Risks

### R-01 — Built-in Git API compatibility

Mitigation:

- isolate the API;
- consume only versioned public shapes;
- test supported VS Code versions;
- degrade cleanly.

### R-02 — Multi-selection ordering ambiguity

Mitigation:

- track false-to-true transitions;
- maintain selection epochs;
- use deterministic activation fallback.

### R-03 — Reduced language support for external files

Mitigation:

- document the limitation;
- do not represent the view as a complete project workspace;
- consider an Open Worktree in New Window feature later.

### R-04 — Watcher pressure in large repositories

Mitigation:

- watch only the active root;
- debounce events;
- apply exclusions;
- provide manual refresh;
- profile before release.

### R-05 — Symlink escape

Mitigation:

- resolve targets before mutation;
- keep one centralized boundary guard;
- expose external symlinks as read-only/non-expandable.

### R-06 — Root-switch races

Mitigation:

- use root-generation tokens;
- revalidate before mutation;
- dispose old watcher immediately.

### R-07 — Expectation of full Explorer parity

Mitigation:

- document MVP scope;
- use native UX;
- maintain a transparent backlog.

---

## 32. Backlog

- drag-and-drop;
- copy/cut/paste;
- multi-selection operations;
- Git status decorations;
- compare matching files across worktrees;
- reveal active editor file;
- search inside selected worktree;
- create/delete worktrees;
- open worktree in a new window;
- terminal rooted at worktree;
- pin/freeze automatic following;
- multiple simultaneous worktree views;
- recent/favorite worktrees;
- branch cleanliness and HEAD information;
- remote-environment certification;
- file nesting and compact folders.

---

## 33. Recommended repository structure

```text
worktree-explorer/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── .vscode/
├── src/
│   ├── extension.ts
│   ├── git/
│   ├── selection/
│   ├── tree/
│   ├── filesystem/
│   ├── commands/
│   ├── ui/
│   ├── persistence/
│   └── common/
├── test/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── resources/
├── PRD.md
├── IMPLEMENTATION_ISSUES.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── tsconfig.json
└── eslint.config.js
```

---

## 34. Definition of done

The first release is complete when:

1. Worktree Explorer appears in the Explorer container for a selected linked worktree.
2. Selecting only the main repository hides it.
3. Multiple selected worktrees resolve to the most recently selected one.
4. A user can manually select any discovered linked worktree.
5. Manual selection remains until SCM selection changes.
6. The active worktree is clearly identified.
7. Files and directories can be browsed.
8. Files can be opened.
9. Files and directories can be created.
10. Files and directories can be renamed.
11. Files and directories can be safely deleted.
12. All mutations are root-bounded.
13. Workspace membership never changes.
14. Filesystem changes refresh automatically.
15. Removed worktrees are handled safely.
16. Git-unavailable behavior is clear.
17. Tests pass on Windows, macOS, and Linux.
18. The extension packages as a VSIX.
19. Documentation explains limitations and isolation.
20. No telemetry or external data transmission is present.
