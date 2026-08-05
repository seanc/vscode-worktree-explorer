import * as vscode from 'vscode';
import { readTreeConfig } from '../tree';
import { OPEN_COMMAND } from './constants';

/**
 * PRD §10.6/AC-06: opens a file through VS Code's document APIs. Uses the generic `vscode.open`
 * built-in command (rather than workspace.openTextDocument + showTextDocument) so binary/image
 * files open in their appropriate editor too, not just text files. Never touches workspace
 * folders — opening a file this way cannot add its directory to the workspace.
 */
export function registerOpenCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_COMMAND, async (uri: vscode.Uri) => {
    const { openFilesInPreview } = readTreeConfig();
    await vscode.commands.executeCommand('vscode.open', uri, { preview: openFilesInPreview });
  });
}
