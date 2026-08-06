import { copyRelativePath, copyAbsolutePath, revealInOperatingSystem, copyWorktreePath, revealWorktreeRoot } from '../../src/commands';

// revealFileInOS opens a real OS file-explorer window, so it is never actually invoked in
// automated tests (here or in the live suite) — only that these functions no-op safely without
// an item/active root, before ever reaching it, is covered; the reveal behavior itself is a
// manual check, the same category of limitation as showQuickPick/showInputBox (#5/#9/#10).
//
// These call the plain functions directly rather than going through
// vscode.commands.registerCommand: the running extension (activated automatically via
// onStartupFinished in this test host) already owns each worktreeExplorer.* command id, so
// re-registering the same id here would collide.
suite('Path and OS utility commands (#11) no-op safety', () => {
  const noActiveRootSelection = { snapshot: { activeWorktreeUri: undefined, activeSource: undefined, rootGeneration: 0 } };

  test('copy* functions do not throw with no active root / no item', async () => {
    await copyRelativePath({ selection: noActiveRootSelection }, undefined);
    await copyAbsolutePath(undefined);
    await copyWorktreePath({ selection: noActiveRootSelection });
  });

  test('reveal* functions do not throw (and never reach revealFileInOS) with no active root / no item', async () => {
    await revealInOperatingSystem(undefined);
    await revealWorktreeRoot({ selection: noActiveRootSelection });
  });
});
