import * as assert from 'assert';
import * as vscode from 'vscode';
import { PersistenceService, isRestoreLastSelectionEnabled, type PersistenceGitSource } from '../../src/persistence';
import type { SelectionSnapshot } from '../../src/selection';
import { descriptor } from './fixtures';

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

function fakeGitIntegration(worktreeUris: string[]): PersistenceGitSource {
  return {
    listWorktrees: () => worktreeUris.map((uri) => descriptor(uri.replace('file://', ''), false))
  };
}

function fakeSelection(): { onDidChangeSelection: vscode.Event<SelectionSnapshot>; fire: (snapshot: SelectionSnapshot) => void } {
  const emitter = new vscode.EventEmitter<SelectionSnapshot>();
  return { onDidChangeSelection: emitter.event, fire: (snapshot) => emitter.fire(snapshot) };
}

function snapshot(activeWorktreeUri: vscode.Uri | undefined, activeSource: SelectionSnapshot['activeSource']): SelectionSnapshot {
  return { activeWorktreeUri, activeSource, rootGeneration: 1 };
}

suite('PersistenceService', () => {
  test('load() is undefined before anything has been persisted', () => {
    const service = new PersistenceService(fakeMemento(), fakeGitIntegration([]), fakeSelection());
    assert.strictEqual(service.load(), undefined);
  });

  test('FR-050: an SCM-resolved selection persists lastActiveWorktreeUri and activeSource', () => {
    const selection = fakeSelection();
    const service = new PersistenceService(fakeMemento(), fakeGitIntegration([]), selection);
    const uri = vscode.Uri.file('/repo-wt');

    selection.fire(snapshot(uri, 'scm'));

    assert.deepStrictEqual(service.load(), { lastActiveWorktreeUri: uri.toString(), activeSource: 'scm', lastManualWorktreeUri: undefined });
  });

  test('FR-050: a manual selection also updates lastManualWorktreeUri', () => {
    const selection = fakeSelection();
    const service = new PersistenceService(fakeMemento(), fakeGitIntegration([]), selection);
    const uri = vscode.Uri.file('/repo-wt');

    selection.fire(snapshot(uri, 'manual'));

    assert.strictEqual(service.load()?.lastManualWorktreeUri, uri.toString());
  });

  test('PRD §9.4: hiding the view (activeWorktreeUri undefined) does not clear persisted history', () => {
    const selection = fakeSelection();
    const service = new PersistenceService(fakeMemento(), fakeGitIntegration([]), selection);
    const uri = vscode.Uri.file('/repo-wt');
    selection.fire(snapshot(uri, 'scm'));

    selection.fire(snapshot(undefined, undefined));

    assert.strictEqual(service.load()?.lastActiveWorktreeUri, uri.toString());
  });

  test('FR-051: a stale lastManualWorktreeUri is pruned once a later selection change checks it against live discovery', () => {
    const selection = fakeSelection();
    const staleUri = vscode.Uri.file('/repo-stale-wt');
    const gitIntegration = fakeGitIntegration([]); // the stale worktree no longer exists
    const service = new PersistenceService(fakeMemento(), gitIntegration, selection);
    selection.fire(snapshot(staleUri, 'manual'));
    assert.strictEqual(service.load()?.lastManualWorktreeUri, staleUri.toString());

    // A new SCM selection elsewhere triggers persist() again, which re-checks the old manual URI.
    selection.fire(snapshot(vscode.Uri.file('/repo-other-wt'), 'scm'));

    assert.strictEqual(service.load()?.lastManualWorktreeUri, undefined);
  });

  test('a still-valid lastManualWorktreeUri survives an unrelated SCM selection change', () => {
    const selection = fakeSelection();
    const manualUri = vscode.Uri.file('/repo-manual-wt');
    const gitIntegration = fakeGitIntegration([manualUri.toString()]);
    const service = new PersistenceService(fakeMemento(), gitIntegration, selection);
    selection.fire(snapshot(manualUri, 'manual'));

    selection.fire(snapshot(vscode.Uri.file('/repo-other-wt'), 'scm'));

    assert.strictEqual(service.load()?.lastManualWorktreeUri, manualUri.toString());
  });

  test('isRestoreLastSelectionEnabled() defaults to true (PRD §19.2)', () => {
    assert.strictEqual(isRestoreLastSelectionEnabled(), true);
  });
});
