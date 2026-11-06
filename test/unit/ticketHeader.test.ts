import * as assert from 'assert';
import * as vscode from 'vscode';
import { describeTicketHeader, type TicketInfo } from '../../src/ticket';
import { openTicketLink, openTicketNotes, copyTestCommand, type TicketCommandDependencies } from '../../src/commands';
import { descriptor } from './fixtures';

const worktree = descriptor('/repo-wt', false);

function info(overrides: Partial<TicketInfo> = {}): TicketInfo {
  return {
    worktree,
    metadata: {
      key: 'PROJ-1',
      summary: 'Fix the thing',
      ticketUrl: 'https://example.atlassian.net/browse/PROJ-1',
      devDatabases: [],
      testDatabases: [],
      testCommand: 'php artisan test <path>',
      notesUri: vscode.Uri.file('/repo-wt/CLAUDE.local.md')
    },
    comparison: { baseRef: 'develop', baseSource: 'default', mergeBase: 'abc', ahead: 2, changedVsBase: [], uncommitted: [], baseCommitMessages: [] },
    ...overrides
  };
}

function deps(ticket: TicketInfo | undefined, opened: vscode.Uri[]): TicketCommandDependencies {
  return {
    tickets: { getTicket: async () => ticket },
    selection: { snapshot: { activeWorktreeUri: worktree.rootUri, activeSource: 'scm', rootGeneration: 1 } },
    openExternal: async (uri) => {
      opened.push(uri);
      return true;
    }
  };
}

suite('Ticket header and commands (#19)', () => {
  test('describes key, ahead count and base, with the summary as the message', () => {
    const header = describeTicketHeader(info());
    assert.strictEqual(header.description, 'PROJ-1 · ↑2 vs develop');
    assert.strictEqual(header.message, 'Fix the thing');
    assert.deepStrictEqual([header.hasUrl, header.hasNotes, header.hasTestCommand], [true, true, true]);
  });

  test('#23: names a stacked base by its ticket key, and drops "origin/"', () => {
    const stacked = info({
      comparison: { ...info().comparison!, baseRef: 'feature/ab/PROJ-1290-dashboard-redesign', baseSource: 'created-from' }
    });
    assert.strictEqual(describeTicketHeader(stacked).description, 'PROJ-1 · ↑2 vs PROJ-1290 branch');
    const remote = info({ comparison: { ...info().comparison!, baseRef: 'origin/develop', baseSource: 'created-from' } });
    assert.strictEqual(describeTicketHeader(remote).description, 'PROJ-1 · ↑2 vs develop');
  });

  test('omits the comparison when there is no base branch', () => {
    assert.strictEqual(describeTicketHeader(info({ comparison: undefined })).description, 'PROJ-1');
  });

  test('falls back to the default description when the worktree has no ticket key', () => {
    const header = describeTicketHeader(info({ metadata: undefined }));
    assert.strictEqual(header.description, undefined);
    assert.strictEqual(header.message, undefined);
    assert.deepStrictEqual([header.hasUrl, header.hasNotes, header.hasTestCommand], [false, false, false]);
    assert.strictEqual(describeTicketHeader(undefined).description, undefined);
  });

  test('Open Ticket opens only the validated link', async () => {
    const opened: vscode.Uri[] = [];
    assert.strictEqual(await openTicketLink(deps(info(), opened)), true);
    assert.deepStrictEqual(opened.map(String), ['https://example.atlassian.net/browse/PROJ-1']);
  });

  test('Open Ticket does nothing without a link', async () => {
    const opened: vscode.Uri[] = [];
    const noLink = info({ metadata: { ...info().metadata!, ticketUrl: undefined } });
    assert.strictEqual(await openTicketLink(deps(noLink, opened)), false);
    assert.strictEqual(await openTicketLink(deps(undefined, opened)), false);
    assert.strictEqual(opened.length, 0);
  });

  test('a Tickets-view target overrides the active worktree', async () => {
    const asked: string[] = [];
    const target = vscode.Uri.file('/other-wt');
    const d: TicketCommandDependencies = {
      ...deps(undefined, []),
      tickets: {
        getTicket: async (uri) => {
          asked.push(uri.fsPath);
          return undefined;
        }
      }
    };
    await openTicketLink(d, { rootUri: target });
    assert.deepStrictEqual(asked, [target.fsPath]);
  });

  test('Open Notes and Copy Test Command no-op safely without data', async () => {
    const empty = info({ metadata: { key: 'PROJ-1', devDatabases: [], testDatabases: [] } });
    assert.strictEqual(await openTicketNotes(deps(empty, [])), false);
    assert.strictEqual(await copyTestCommand(deps(empty, [])), false);
  });

  test('Copy Test Command writes the command to the clipboard', async () => {
    assert.strictEqual(await copyTestCommand(deps(info(), [])), true);
    assert.strictEqual(await vscode.env.clipboard.readText(), 'php artisan test <path>');
  });
});
