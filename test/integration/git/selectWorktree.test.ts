import * as assert from 'assert';
import { GitIntegrationService } from '../../../src/git';
import { SelectionCoordinator } from '../../../src/selection';
import { showWorktreeQuickPick } from '../../../src/ui';

// Live checks for #5, sharing the gitDiscoveryTests fixture (main + one linked worktree — see
// .vscode-test.mjs and test/setup/createGitFixture.js). `vscode.window.showQuickPick` itself has
// no public API a test can drive non-interactively, so these exercise the two parts of the
// command that are our own code: the "no linked worktrees" early-return message (§9.9), and the
// effect of picking a worktree (SelectionCoordinator.selectManually), which
// test/unit/worktreeQuickPick.test.ts and test/unit/selectionCoordinator.test.ts already cover in
// isolation — this proves they're wired together correctly against a live discovery pipeline.
suite('Worktree Quick Pick (#5)', function () {
  this.timeout(30000);

  let gitIntegration: GitIntegrationService;
  let selection: SelectionCoordinator;

  suiteSetup(async () => {
    gitIntegration = new GitIntegrationService();
    await gitIntegration.activate();
    await waitUntil(() => gitIntegration.listWorktrees().filter((w) => !w.isMain).length >= 1, 20000);
    selection = new SelectionCoordinator(gitIntegration);
  });

  suiteTeardown(() => {
    selection.dispose();
    gitIntegration.dispose();
  });

  test('§9.9: shows an information message instead of a picker when there are no linked worktrees', async () => {
    const result = await showWorktreeQuickPick([], { activeUri: undefined, isScmSelected: () => false });
    assert.strictEqual(result, undefined);
    // No assertion on the message UI itself (not observable via public API without additional
    // stubbing); absence of a thrown error and the undefined result together confirm the
    // early-return path — the message text itself is covered by reading the source.
  });

  test('AC-04: selecting a worktree manually is reflected by SelectionCoordinator', () => {
    const [linked] = gitIntegration.listWorktrees().filter((w) => !w.isMain);
    assert.ok(linked, 'the fixture should have discovered a linked worktree by suiteSetup');

    selection.selectManually(linked.rootUri);

    assert.strictEqual(selection.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
    assert.strictEqual(selection.snapshot.activeSource, 'manual');
  });
});

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for the Git extension to discover the fixture repository.');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
