import * as assert from 'assert';
import * as vscode from 'vscode';
import { createEntry, type NewEntryDependencies } from '../../src/commands';
import type { GuardContext, GuardResult } from '../../src/filesystem';
import { OperationError } from '../../src/common';
import { fakeOutputChannel } from './fixtures';

function makeDeps(overrides: {
  resolveNewPath: (context: GuardContext, parentUri: vscode.Uri, name: string, generation: number) => GuardResult;
  createFile?: (uri: vscode.Uri) => Promise<void>;
  createDirectory?: (uri: vscode.Uri) => Promise<void>;
}): { deps: NewEntryDependencies; calls: { refreshed: boolean; created: vscode.Uri[] } } {
  const calls = { refreshed: false, created: [] as vscode.Uri[] };
  const deps: NewEntryDependencies = {
    guard: { resolveNewPath: overrides.resolveNewPath },
    fileSystem: {
      createFile: async (uri: vscode.Uri) => {
        calls.created.push(uri);
        await overrides.createFile?.(uri);
      },
      createDirectory: async (uri: vscode.Uri) => {
        calls.created.push(uri);
        await overrides.createDirectory?.(uri);
      }
    },
    selection: { snapshot: { activeWorktreeUri: vscode.Uri.file('/repo-wt'), activeSource: 'scm', rootGeneration: 1 } },
    treeProvider: { refresh: () => (calls.refreshed = true) },
    outputChannel: fakeOutputChannel()
  };
  return { deps, calls };
}

const context: GuardContext = { rootUri: vscode.Uri.file('/repo-wt'), rootGeneration: 1 };

suite('createEntry (New File / New Folder core)', () => {
  test('AC-07: on success, calls FileSystemService and refreshes the tree', async () => {
    const target = vscode.Uri.joinPath(context.rootUri, 'new-dir');
    const { deps, calls } = makeDeps({ resolveNewPath: () => ({ ok: true, uri: target }) });

    const result = await createEntry(deps, context, context.rootUri, 'new-dir', 'folder');

    assert.strictEqual(result?.toString(), target.toString());
    assert.strictEqual(calls.created.length, 1);
    assert.strictEqual(calls.refreshed, true);
  });

  test('a guard rejection stops before touching the filesystem', async () => {
    const { deps, calls } = makeDeps({ resolveNewPath: () => ({ ok: false, reason: 'traversal' }) });

    const result = await createEntry(deps, context, context.rootUri, '../escape.txt', 'file');

    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.created.length, 0);
    assert.strictEqual(calls.refreshed, false);
  });

  test('a FileSystemService OperationError (e.g. destinationExists) does not refresh or throw', async () => {
    const target = vscode.Uri.joinPath(context.rootUri, 'existing.txt');
    const { deps, calls } = makeDeps({
      resolveNewPath: () => ({ ok: true, uri: target }),
      createFile: async () => {
        throw new OperationError('destinationExists');
      }
    });

    const result = await createEntry(deps, context, context.rootUri, 'existing.txt', 'file');

    assert.strictEqual(result, undefined);
    assert.strictEqual(calls.refreshed, false);
  });

  test('SEC-03: passes the current (not the captured) generation to the guard', async () => {
    let observedGeneration: number | undefined;
    // 'folder' kind: avoids a spurious "file not found" editor-open attempt against this fake,
    // nonexistent target — this test is only about which generation value reaches the guard.
    const target = vscode.Uri.joinPath(context.rootUri, 'new-dir');
    const staleContext: GuardContext = { rootUri: context.rootUri, rootGeneration: 1 };
    const { deps } = makeDeps({
      resolveNewPath: (_ctx, _parent, _name, generation) => {
        observedGeneration = generation;
        return { ok: true, uri: target };
      }
    });
    // selection.snapshot.rootGeneration in makeDeps is 1; simulate the root having since moved on
    // by giving createEntry a context captured at an earlier (stale) generation.
    await createEntry(deps, staleContext, context.rootUri, 'new-dir', 'folder');
    assert.strictEqual(observedGeneration, deps.selection.snapshot.rootGeneration);
  });
});
