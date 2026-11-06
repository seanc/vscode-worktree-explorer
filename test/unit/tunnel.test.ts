import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { buildServeCommand, isSafeServeTarget, isServed, readServedPath, describeServe, serveViaTunnel } from '../../src/tunnel';
import { buildSidebarModel } from '../../src/tickets';
import type { TicketInfo } from '../../src/ticket';
import type { WorktreeDescriptor } from '../../src/common/types';

const main: WorktreeDescriptor = {
  repositoryRoot: vscode.Uri.file('/repo'),
  rootUri: vscode.Uri.file('/repo'),
  displayName: 'repo',
  ref: 'develop',
  isMain: true,
  isDetached: false
};
const linked: WorktreeDescriptor = { ...main, rootUri: vscode.Uri.file('/repo/.wt/PROJ-1'), displayName: 'PROJ-1', ref: 'task/jd/PROJ-1-x', isMain: false };
const ticket: TicketInfo = { worktree: linked, metadata: { key: 'PROJ-1', devDatabases: [], testDatabases: [] } };

suite('Serve through the tunnel (#26)', () => {
  test('builds the command only from a {target} template and a plain target', () => {
    assert.strictEqual(buildServeCommand('tiggit serve {target}', 'PROJ-1'), 'tiggit serve PROJ-1');
    assert.strictEqual(buildServeCommand('tiggit serve {target}', 'main'), 'tiggit serve main');
    assert.strictEqual(buildServeCommand('tiggit serve', 'PROJ-1'), undefined);
    assert.strictEqual(buildServeCommand('', 'PROJ-1'), undefined);
    assert.strictEqual(buildServeCommand('tiggit serve {target}', undefined), undefined);
    for (const unsafe of ['PROJ-1; rm -rf ~', '$(id)', 'a b', '-rf', '`x`', '']) {
      assert.ok(!isSafeServeTarget(unsafe), unsafe);
      assert.strictEqual(buildServeCommand('tiggit serve {target}', unsafe), undefined, unsafe);
    }
  });

  test('reads which checkout the site link points at', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tunnel-'));
    try {
      const checkout = path.join(dir, 'checkout');
      fs.mkdirSync(checkout);
      const link = path.join(dir, 'site.example');
      fs.symlinkSync(checkout, link);
      assert.strictEqual(await readServedPath(link), checkout);
      assert.strictEqual(await readServedPath(path.join(dir, 'missing')), undefined);
      assert.strictEqual(await readServedPath('relative/link'), undefined);
      assert.strictEqual(await readServedPath(''), undefined);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('matches the served checkout regardless of a trailing slash', () => {
    assert.ok(isServed(linked.rootUri, `${linked.rootUri.fsPath}/`));
    assert.ok(!isServed(linked.rootUri, main.rootUri.fsPath));
    assert.ok(!isServed(linked.rootUri, undefined));
  });

  test('cards show the Tunnel badge when served, and a Serve button only when not', () => {
    const served = buildSidebarModel([ticket], [main, linked], undefined, {
      cleanupCommandConfigured: false,
      tunnel: { servedPath: linked.rootUri.fsPath, serveConfigured: true }
    });
    assert.strictEqual(served.active[0].served, true);
    assert.strictEqual(served.active[0].canServe, false);
    assert.strictEqual(served.active[0].badges[0].text, '● Tunnel');
    assert.deepStrictEqual([served.main[0].served, served.main[0].canServe], [false, true]);

    const unconfigured = buildSidebarModel([ticket], [main, linked], undefined, { cleanupCommandConfigured: false });
    assert.deepStrictEqual([unconfigured.active[0].canServe, unconfigured.main[0].canServe], [false, false]);
  });

  test('the confirmation warns about other sessions and shows the exact command', () => {
    const text = describeServe('PROJ-1', 'tiggit serve PROJ-1');
    assert.strictEqual(text.message, 'Serve PROJ-1 through the tunnel?');
    assert.ok(text.detail.includes('in the middle of using it'));
    assert.ok(text.detail.includes('tiggit serve PROJ-1'));
    assert.strictEqual(text.button, 'Serve PROJ-1');
  });

  test('without a configured command nothing is asked or run', async () => {
    const ran: string[] = [];
    const ok = await serveViaTunnel(
      {
        tickets: { getTicket: async () => ticket, refresh: () => undefined },
        confirm: async () => true,
        runInTerminal: (_name, _cwd, command) => ran.push(command)
      },
      { rootUri: linked.rootUri }
    );
    assert.strictEqual(ok, false);
    assert.deepStrictEqual(ran, []);
  });
});
