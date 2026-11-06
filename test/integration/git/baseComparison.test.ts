import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitIntegrationService } from '../../../src/git';
import { buildTicketMetadata, readTicketNotes, detectCleanup, DEFAULT_KEY_PATTERN } from '../../../src/ticket';

// #17/#18 live: against the generated ticket worktree (test/setup/createGitFixture.js) — branch
// feature/jd/TEST-1-sample, one commit ahead of main, one uncommitted modification, one untracked
// file, plus an excluded CLAUDE.local.md.
suite('Base-branch comparison and ticket metadata (#17/#18) live', function () {
  this.timeout(30000);

  let gitIntegration: GitIntegrationService;

  suiteSetup(async () => {
    gitIntegration = new GitIntegrationService();
    await gitIntegration.activate();
    await waitUntil(() => {
      const ticket = gitIntegration.listWorktrees().find((w) => w.ref === 'feature/jd/TEST-1-sample');
      return ticket !== undefined;
    }, 20000);
  });

  suiteTeardown(() => gitIntegration.dispose());

  function ticketWorktree() {
    const ticket = gitIntegration.listWorktrees().find((w) => w.ref === 'feature/jd/TEST-1-sample');
    assert.ok(ticket, 'ticket worktree should be discovered');
    return ticket;
  }

  test('compares against main from the merge base', async () => {
    const ticket = ticketWorktree();
    let comparison = await gitIntegration.compareWithBase(ticket.rootUri);
    // The repository's first status refresh can land after discovery; retry briefly.
    for (let i = 0; i < 20 && (!comparison || comparison.uncommitted.length === 0); i++) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      comparison = await gitIntegration.compareWithBase(ticket.rootUri);
    }

    assert.ok(comparison);
    assert.strictEqual(comparison.baseRef, 'main');
    assert.strictEqual(comparison.ahead, 1);
    const changed = Object.fromEntries(comparison.changedVsBase.map((c) => [path.basename(c.uri.fsPath), c.status]));
    assert.strictEqual(changed['feature.txt'], 'added');
    assert.strictEqual(changed['README.md'], 'modified');
    assert.strictEqual(changed['scratch.txt'], 'untracked');
    assert.strictEqual(changed['CLAUDE.local.md'], undefined, 'excluded notes file is not a change');

    const uncommitted = comparison.uncommitted.map((c) => path.basename(c.uri.fsPath)).sort();
    assert.deepStrictEqual(uncommitted, ['README.md', 'scratch.txt']);
  });

  test('reads ticket metadata from the branch and the notes file', async () => {
    const ticket = ticketWorktree();
    const notes = await readTicketNotes(ticket.rootUri, 'CLAUDE.local.md');
    const metadata = buildTicketMetadata(
      { branch: ticket.ref, folderName: ticket.displayName, notes: notes?.notes, notesUri: notes?.uri },
      { keyPattern: DEFAULT_KEY_PATTERN, urlTemplate: '', notesFile: 'CLAUDE.local.md' }
    );

    assert.ok(metadata);
    assert.strictEqual(metadata.key, 'TEST-1');
    assert.strictEqual(metadata.branchType, 'feature');
    assert.strictEqual(metadata.summary, 'Sample ticket for the fixture');
    assert.strictEqual(metadata.ticketUrl, 'https://example.atlassian.net/browse/TEST-1');
    assert.deepStrictEqual(metadata.devDatabases, ['app_test_1']);
    assert.ok(metadata.notesUri);
  });

  test('#23: a stacked branch is compared against the branch it was created from', async () => {
    await waitUntil(() => gitIntegration.listWorktrees().some((w) => w.ref === 'feature/jd/TEST-3-stacked'), 20000);
    const stacked = gitIntegration.listWorktrees().find((w) => w.ref === 'feature/jd/TEST-3-stacked');
    assert.ok(stacked);
    const comparison = await gitIntegration.compareWithBase(stacked.rootUri);
    assert.ok(comparison);
    assert.strictEqual(comparison.baseRef, 'feature/x');
    assert.strictEqual(comparison.baseSource, 'created-from');
    assert.strictEqual(comparison.ahead, 0);
  });

  test('#24: a ticket whose key appears in a later base commit looks merged', async () => {
    await waitUntil(() => gitIntegration.listWorktrees().some((w) => w.ref === 'feature/jd/TEST-2-done'), 20000);
    const merged = gitIntegration.listWorktrees().find((w) => w.ref === 'feature/jd/TEST-2-done');
    assert.ok(merged);
    const comparison = await gitIntegration.compareWithBase(merged.rootUri);
    assert.ok(comparison);
    assert.strictEqual(detectCleanup('TEST-2', comparison)?.kind, 'merged');
    assert.strictEqual(detectCleanup('TEST-1', comparison), undefined);
  });

  test('#24: Git refuses to remove a worktree with uncommitted changes (no force)', async () => {
    const ticket = ticketWorktree();
    await assert.rejects(() => gitIntegration.removeWorktree(ticket.rootUri), /uncommitted or untracked|could not remove/);
    assert.ok(gitIntegration.listWorktrees().some((w) => w.rootUri.toString() === ticket.rootUri.toString()));
  });

  test('#24: the main checkout can never be removed', async () => {
    const main = gitIntegration.listWorktrees().find((w) => w.isMain);
    assert.ok(main);
    await assert.rejects(() => gitIntegration.removeWorktree(main.rootUri), /Only a linked worktree/);
  });

  test('#24: a clean linked worktree is removed and its folder is gone', async () => {
    const merged = gitIntegration.listWorktrees().find((w) => w.ref === 'feature/jd/TEST-2-done');
    assert.ok(merged);
    await gitIntegration.removeWorktree(merged.rootUri);
    await assert.rejects(() => Promise.resolve(vscode.workspace.fs.stat(merged.rootUri)));
  });

  test('the main repository has no base comparison against itself beyond zero ahead', async () => {
    const main = gitIntegration.listWorktrees().find((w) => w.isMain);
    assert.ok(main);
    const comparison = await gitIntegration.compareWithBase(main.rootUri);
    assert.ok(comparison);
    assert.strictEqual(comparison.ahead, 0);
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
