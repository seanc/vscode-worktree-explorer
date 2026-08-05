import * as vscode from 'vscode';
import type { WorktreeDescriptor } from '../../src/common/types';

/** Shared test helper: a minimal WorktreeDescriptor for a given path. Not itself a "*.test.ts"
 *  file, so it is excluded from suite discovery by the glob in .vscode-test.mjs. */
export function descriptor(path: string, isMain: boolean): WorktreeDescriptor {
  const uri = vscode.Uri.file(path);
  return { repositoryRoot: uri, rootUri: uri, displayName: path, isMain, isDetached: false };
}
