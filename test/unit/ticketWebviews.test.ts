import * as assert from 'assert';
import * as vscode from 'vscode';
import { buildSidebarModel, buildOverviewModel, parseWebviewMessage, renderWebviewShell, createNonce } from '../../src/tickets';
import type { TicketInfo } from '../../src/ticket';
import type { BaseComparison, WorktreeDescriptor } from '../../src/common/types';

const main: WorktreeDescriptor = {
  repositoryRoot: vscode.Uri.file('/repo'),
  rootUri: vscode.Uri.file('/repo'),
  displayName: 'repo',
  ref: 'develop',
  isMain: true,
  isDetached: false
};

function worktree(name: string, ref: string): WorktreeDescriptor {
  return { repositoryRoot: main.rootUri, rootUri: vscode.Uri.file(`/repo/.wt/${name}`), displayName: name, ref, isMain: false, isDetached: false };
}

function comparison(overrides: Partial<BaseComparison> = {}): BaseComparison {
  return { baseRef: 'origin/develop', baseSource: 'created-from', mergeBase: 'm', ahead: 2, changedVsBase: [], uncommitted: [], baseCommitMessages: [], ...overrides };
}

const wt = worktree('PROJ-1302', 'task/jd/PROJ-1302-date-range');
const active: TicketInfo = {
  worktree: wt,
  metadata: {
    key: 'PROJ-1302',
    branchType: 'task',
    summary: 'Date-range helper: <img src=x onerror=alert(1)>',
    ticketUrl: 'https://example.atlassian.net/browse/PROJ-1302',
    devDatabases: ['app_proj_32724'],
    testDatabases: ['app_test_proj_32724'],
    testCommand: 'php artisan test <path>',
    notesUri: vscode.Uri.joinPath(wt.rootUri, 'CLAUDE.local.md')
  },
  comparison: comparison({
    baseRef: 'feature/ab/PROJ-1290-dashboard-redesign',
    changedVsBase: [
      { uri: vscode.Uri.joinPath(wt.rootUri, 'app', 'Timeline.php'), status: 'modified' },
      { uri: vscode.Uri.joinPath(wt.rootUri, 'old.txt'), status: 'deleted' }
    ],
    uncommitted: [{ uri: vscode.Uri.joinPath(wt.rootUri, 'app', 'Timeline.php'), status: 'modified' }]
  })
};
const merged: TicketInfo = {
  worktree: worktree('PROJ-1254', 'task/jd/PROJ-1254-newsletter'),
  metadata: { key: 'PROJ-1254', devDatabases: [], testDatabases: [] },
  comparison: comparison(),
  cleanup: { kind: 'merged', evidence: 'PROJ-1254 Remove the legacy newsletter opt-in (#412)' }
};

suite('Ticket webviews (#25)', () => {
  suite('view models', () => {
    test('sidebar: active cards, cleanup cards, and the main checkout', () => {
      const model = buildSidebarModel([merged, active], [main, active.worktree, merged.worktree], wt.rootUri, { cleanupCommandConfigured: true });
      assert.deepStrictEqual(model.active.map((c) => c.key), ['PROJ-1302']);
      assert.deepStrictEqual(model.cleanup.map((c) => c.key), ['PROJ-1254']);
      assert.deepStrictEqual(model.main, [{ id: main.rootUri.toString(), branch: 'develop', served: false, canServe: false }]);

      const card = model.active[0];
      assert.strictEqual(card.isActive, true);
      assert.strictEqual(card.title, 'Date-range helper: <img src=x onerror=alert(1)>', 'text is passed through as data, never as HTML');
      assert.deepStrictEqual(card.badges.map((b) => b.text), ['↑2 · 2 changed', 'vs PROJ-1290 branch', '1 uncommitted']);
      assert.deepStrictEqual([card.hasUrl, card.hasNotes, card.hasTest], [true, true, true]);
      assert.deepStrictEqual([card.devDatabases, card.testDatabases], [['app_proj_32724'], ['app_test_proj_32724']]);
      assert.deepStrictEqual(model.cleanup[0].cleanup, { evidence: 'PROJ-1254 Remove the legacy newsletter opt-in (#412)', uncommitted: 0 });
    });

    test('overview: header, base source, environment, and relative change paths', () => {
      const model = buildOverviewModel(active, true, { cleanupCommandConfigured: false });
      assert.strictEqual(model.key, 'PROJ-1302');
      assert.strictEqual(model.kind, 'task');
      assert.strictEqual(model.aheadText, '2 commits ahead of PROJ-1290 branch');
      assert.strictEqual(model.baseText, 'Compared with feature/ab/PROJ-1290-dashboard-redesign (the branch it was created from)');
      assert.deepStrictEqual(model.environment.map((e) => e.label), ['Dev databases', 'Test databases', 'Folder']);
      assert.deepStrictEqual(
        model.changes.map((c) => [c.letter, c.path, c.deleted]),
        [
          ['M', 'app/Timeline.php', false],
          ['D', 'old.txt', true]
        ]
      );
    });

    test('overview without a base branch says so plainly', () => {
      const model = buildOverviewModel({ worktree: worktree('scratch', 'experiment') }, false, { cleanupCommandConfigured: false });
      assert.strictEqual(model.aheadText, undefined);
      assert.strictEqual(model.baseText, 'No base branch found. Set worktreeExplorer.baseBranch.');
      assert.deepStrictEqual(model.changes, []);
    });
  });

  suite('message validation', () => {
    const roots = new Map([[wt.rootUri.toString(), wt.rootUri]]);
    const id = wt.rootUri.toString();

    test('accepts known actions for a discovered worktree', () => {
      assert.strictEqual(parseWebviewMessage({ action: 'openWindow', id }, roots)?.rootUri?.toString(), id);
      assert.strictEqual(parseWebviewMessage({ action: 'refresh' }, roots)?.action, 'refresh');
      const compare = parseWebviewMessage({ action: 'compare', id, path: 'app/Timeline.php', deleted: true, extra: 'ignored' }, roots);
      assert.strictEqual(compare?.fileUri?.fsPath, vscode.Uri.joinPath(wt.rootUri, 'app', 'Timeline.php').fsPath);
      assert.strictEqual(compare?.deleted, true);
    });

    test('rejects unknown actions, foreign worktrees, and malformed messages', () => {
      assert.strictEqual(parseWebviewMessage({ action: 'runShell', id }, roots), undefined);
      assert.strictEqual(parseWebviewMessage({ action: 'openWindow', id: vscode.Uri.file('/etc').toString() }, roots), undefined);
      assert.strictEqual(parseWebviewMessage({ action: 'openWindow' }, roots), undefined);
      assert.strictEqual(parseWebviewMessage('openWindow', roots), undefined);
      assert.strictEqual(parseWebviewMessage(null, roots), undefined);
      assert.strictEqual(parseWebviewMessage({ action: 'openLink', id, url: 'https://evil.example' }, roots)?.action, 'openLink', 'a URL field is ignored, never used');
    });

    test('rejects compare paths that leave the worktree', () => {
      for (const path of ['../../etc/passwd', '/etc/passwd', 'a/../../b', 'a\\..\\b', '', 'a//b', './a', 'x'.repeat(2000)]) {
        assert.strictEqual(parseWebviewMessage({ action: 'compare', id, path }, roots), undefined, path);
      }
      assert.strictEqual(parseWebviewMessage({ action: 'compare', id, path: 42 }, roots), undefined);
    });
  });

  test('the page shell carries a nonce-only CSP and no ticket data', () => {
    const nonce = createNonce();
    assert.match(nonce, /^[A-Za-z0-9]{32}$/);
    assert.notStrictEqual(nonce, createNonce());
    const html = renderWebviewShell({ cspSource: 'vscode-webview://x', nonce, styleUri: 'style.css', scriptUris: ['a.js', 'b.js'], title: 'Tickets' });
    assert.ok(html.includes(`default-src 'none'`));
    assert.ok(html.includes(`script-src 'nonce-${nonce}'`));
    assert.ok(!html.includes('unsafe-inline') && !html.includes('unsafe-eval'));
    assert.strictEqual((html.match(new RegExp(`<script nonce="${nonce}"`, 'g')) ?? []).length, 2);
    assert.ok(!html.includes('HL-'), 'no ticket data in the HTML');
  });
});
