import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitIntegrationService } from '../../../src/git';
import { SelectionCoordinator } from '../../../src/selection';
import { PersistenceService } from '../../../src/persistence';

// Live checks (#12) against the #3 git fixture. "Restart" is simulated by constructing a second,
// independent SelectionCoordinator/PersistenceService pair against the same in-memory Memento and
// the same live GitIntegrationService — the persisted-state contract is what's under test, not
// an actual VS Code window reload.
suite('PersistenceService (#12) live', function () {
  this.timeout(20000);

  let gitIntegration: GitIntegrationService;
  let memento: vscode.Memento;

  suiteSetup(async () => {
    gitIntegration = new GitIntegrationService();
    await gitIntegration.activate();
    await waitUntil(() => gitIntegration.listWorktrees().filter((w) => !w.isMain).length >= 1, 20000);
    memento = fakeMemento();
  });

  suiteTeardown(() => {
    gitIntegration.dispose();
  });

  test('a manually selected worktree is restored across a simulated restart', async () => {
    const [linked] = gitIntegration.listWorktrees().filter((w) => !w.isMain);
    assert.ok(linked);

    const firstSession = new SelectionCoordinator(gitIntegration);
    const firstPersistence = new PersistenceService(memento, gitIntegration, firstSession);
    firstSession.selectManually(linked.rootUri);
    firstSession.dispose();
    firstPersistence.dispose();

    const secondSession = new SelectionCoordinator(gitIntegration);
    const secondPersistence = new PersistenceService(memento, gitIntegration, secondSession);
    try {
      const persisted = secondPersistence.load();
      assert.strictEqual(persisted?.lastActiveWorktreeUri, linked.rootUri.toString());

      secondSession.restore(vscode.Uri.parse(persisted.lastActiveWorktreeUri));

      assert.strictEqual(secondSession.snapshot.activeWorktreeUri?.toString(), linked.rootUri.toString());
      assert.strictEqual(secondSession.snapshot.activeSource, 'restored');
    } finally {
      secondSession.dispose();
      secondPersistence.dispose();
    }
  });

  test('FR-051: a persisted worktree that no longer exists is not restored', async () => {
    const removedMemento = fakeMemento();
    void removedMemento.update('worktreeExplorer.persistedSelection', {
      lastActiveWorktreeUri: vscode.Uri.file('/nonexistent-removed-worktree').toString(),
      activeSource: 'manual'
    });

    const session = new SelectionCoordinator(gitIntegration);
    const persistence = new PersistenceService(removedMemento, gitIntegration, session);
    try {
      const persisted = persistence.load();
      assert.ok(persisted?.lastActiveWorktreeUri);

      session.restore(vscode.Uri.parse(persisted.lastActiveWorktreeUri));

      // restore() itself validates against live discovery and rejects an unknown worktree —
      // the persisted (now-invalid) entry is not silently trusted.
      assert.notStrictEqual(session.snapshot.activeWorktreeUri?.toString(), vscode.Uri.file('/nonexistent-removed-worktree').toString());
    } finally {
      session.dispose();
      persistence.dispose();
    }
  });
});

function fakeMemento(): vscode.Memento {
  const store = new Map<string, unknown>();
  return {
    get: (<T>(key: string, defaultValue?: T) => (store.has(key) ? store.get(key) : defaultValue)) as vscode.Memento['get'],
    update: (async (key: string, value: unknown) => {
      store.set(key, value);
    }) as vscode.Memento['update'],
    keys: () => [...store.keys()]
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for the Git extension to discover the fixture repository.');
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
