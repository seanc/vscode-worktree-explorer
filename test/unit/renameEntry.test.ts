import * as assert from 'assert';
import * as vscode from 'vscode';
import { renameEntry, type RenameDependencies } from '../../src/commands';
import type { GuardContext, GuardResult } from '../../src/filesystem';
import { OperationError } from '../../src/common';
import { fakeOutputChannel } from './fixtures';

const context: GuardContext = { rootUri: vscode.Uri.file('/repo-wt'), rootGeneration: 1 };

function makeDeps(overrides: {
  validateExistingTarget?: () => Promise<GuardResult> | GuardResult;
  resolveNewPath?: () => GuardResult;
  rename?: (source: vscode.Uri, destination: vscode.Uri) => Promise<void>;
}): { deps: RenameDependencies; calls: { refreshed: boolean; renamed: Array<[vscode.Uri, vscode.Uri]> } } {
  const calls = { refreshed: false, renamed: [] as Array<[vscode.Uri, vscode.Uri]> };
  const deps: RenameDependencies = {
    guard: {
      validateExistingTarget: async () => (overrides.validateExistingTarget ? await overrides.validateExistingTarget() : { ok: true }),
      resolveNewPath: () => (overrides.resolveNewPath ? overrides.resolveNewPath() : { ok: true, uri: vscode.Uri.file('/repo-wt/new.txt') })
    },
    fileSystem: {
      rename: async (source, destination) => {
        calls.renamed.push([source, destination]);
        await overrides.rename?.(source, destination);
      }
    },
    selection: { snapshot: { activeWorktreeUri: context.rootUri, activeSource: 'scm', rootGeneration: 1 } },
    treeProvider: { refresh: () => (calls.refreshed = true) },
    outputChannel: fakeOutputChannel()
  };
  return { deps, calls };
}

suite('renameEntry (Rename core)', () => {
  test('AC-08: on success, renames and refreshes without touching selection', async () => {
    const destination = vscode.Uri.file('/repo-wt/new.txt');
    const { deps, calls } = makeDeps({ resolveNewPath: () => ({ ok: true, uri: destination }) });

    const result = await renameEntry(deps, context, vscode.Uri.file('/repo-wt/old.txt'), 'new.txt');

    assert.strictEqual(result?.toString(), destination.toString());
    assert.strictEqual(calls.renamed.length, 1);
    assert.strictEqual(calls.refreshed, true);
    assert.strictEqual(deps.selection.snapshot.activeSource, 'scm', 'renaming must not change selection source');
  });

  test('FR-FILE-03: rejects a new name containing a path separator, without calling the guard for it', async () => {
    const { deps, calls } = makeDeps({});

    const result = await renameEntry(deps, context, vscode.Uri.file('/repo-wt/old.txt'), 'sub/new.txt');

    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.renamed.length, 0);
  });

  test('a source-validation failure (e.g. the root itself) stops before resolving the destination', async () => {
    const { deps, calls } = makeDeps({ validateExistingTarget: () => ({ ok: false, reason: 'protectedPath' }) });

    const result = await renameEntry(deps, context, context.rootUri, 'renamed');

    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.renamed.length, 0);
  });

  test('an OperationError from the filesystem call refreshes but does not throw', async () => {
    const { deps, calls } = makeDeps({
      rename: async () => {
        throw new OperationError('destinationExists');
      }
    });

    const result = await renameEntry(deps, context, vscode.Uri.file('/repo-wt/old.txt'), 'new.txt');

    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.refreshed, true, 'FR-FILE-06: refresh even on failure, in case of a concurrent change');
  });
});
