import * as assert from 'assert';
import * as vscode from 'vscode';
import { deleteEntry, type DeleteDependencies } from '../../src/commands';
import type { GuardContext, GuardResult, DeleteOptions } from '../../src/filesystem';
import { OperationError } from '../../src/common';
import { fakeOutputChannel } from './fixtures';

const context: GuardContext = { rootUri: vscode.Uri.file('/repo-wt'), rootGeneration: 1 };
const target = vscode.Uri.file('/repo-wt/file.txt');

function makeDeps(overrides: {
  validateExistingTarget?: () => Promise<GuardResult> | GuardResult;
  delete?: (uri: vscode.Uri, options: DeleteOptions) => Promise<void>;
}): { deps: DeleteDependencies; calls: { refreshed: boolean; deleted: Array<[vscode.Uri, DeleteOptions]> } } {
  const calls = { refreshed: false, deleted: [] as Array<[vscode.Uri, DeleteOptions]> };
  const deps: DeleteDependencies = {
    guard: { validateExistingTarget: async () => (overrides.validateExistingTarget ? await overrides.validateExistingTarget() : { ok: true }) },
    fileSystem: {
      delete: async (uri, options) => {
        calls.deleted.push([uri, options]);
        await overrides.delete?.(uri, options);
      }
    },
    selection: { snapshot: { activeWorktreeUri: context.rootUri, activeSource: 'scm', rootGeneration: 1 } },
    treeProvider: { refresh: () => (calls.refreshed = true) },
    outputChannel: fakeOutputChannel()
  };
  return { deps, calls };
}

suite('deleteEntry (Delete core)', () => {
  test('AC-09: on success, deletes with the requested options and refreshes', async () => {
    const { deps, calls } = makeDeps({});

    const success = await deleteEntry(deps, context, target, false, true);

    assert.strictEqual(success, true);
    assert.deepStrictEqual(calls.deleted, [[target, { recursive: false, useTrash: true }]]);
    assert.strictEqual(calls.refreshed, true);
  });

  test('recursive is passed through for folders', async () => {
    const { deps, calls } = makeDeps({});
    await deleteEntry(deps, context, target, true, true);
    assert.strictEqual(calls.deleted[0][1].recursive, true);
  });

  test('AC-10: a guard rejection (e.g. the active root itself) never reaches the filesystem', async () => {
    const { deps, calls } = makeDeps({ validateExistingTarget: () => ({ ok: false, reason: 'protectedPath' }) });

    const success = await deleteEntry(deps, context, context.rootUri, true, true);

    assert.strictEqual(success, false);
    assert.strictEqual(calls.deleted.length, 0);
    assert.strictEqual(calls.refreshed, false);
  });

  test('an OperationError from the filesystem call refreshes but does not throw', async () => {
    const { deps, calls } = makeDeps({
      delete: async () => {
        throw new OperationError('permissionDenied');
      }
    });

    const success = await deleteEntry(deps, context, target, false, true);

    assert.strictEqual(success, false);
    assert.strictEqual(calls.refreshed, true, 'FR-FILE-06: refresh even on failure, in case of a concurrent change');
  });

  test('FR-FILE-06: a non-OperationError failure without trash involved refreshes without retrying', async () => {
    // useTrash: false takes the plain "unexpected error" path (no trash-unavailable prompt,
    // which needs a real showWarningMessage interaction — see the live suite for that branch).
    const { deps, calls } = makeDeps({
      delete: async () => {
        throw new Error('simulated concurrent-change failure');
      }
    });

    const success = await deleteEntry(deps, context, target, false, false);

    assert.strictEqual(success, false);
    assert.strictEqual(calls.deleted.length, 1, 'no automatic retry');
    assert.strictEqual(calls.refreshed, true);
  });
});
