import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  DEFAULT_KEY_PATTERN,
  compileKeyPattern,
  findTicketKey,
  branchType,
  parseTicketNotes,
  validateTicketUrl,
  urlFromTemplate,
  isSafeNotesFileName,
  buildTicketMetadata,
  type TicketConfig
} from '../../src/ticket';

const config: TicketConfig = { keyPattern: DEFAULT_KEY_PATTERN, urlTemplate: '', notesFile: 'CLAUDE.local.md' };

const SAMPLE_NOTES = [
  '# PROJ-12345: Fix CSV export timeout',
  '',
  '- Jira: https://example.atlassian.net/browse/PROJ-12345',
  '- Branch: `fix/jd/PROJ-12345-csv-export-timeout`',
  '- Dev databases (clones, this worktree only): `app_proj_12345`, `app_logs_proj_12345`',
  '- Test databases: `app_test_proj_12345`, `app_test_logs_hl_12345`',
  '',
  '## Running things in this worktree',
  '- Tests: `DB_DATABASE=app_test_proj_12345 php83 artisan test --compact <path>`.',
  '  Always use the prefix.'
].join('\n');

suite('ticketMetadata (#17)', () => {
  suite('key detection', () => {
    test('finds the key in a start-ticket style branch name', () => {
      assert.strictEqual(findTicketKey(['fix/jd/PROJ-12345-csv-export-timeout'], compileKeyPattern(DEFAULT_KEY_PATTERN)), 'PROJ-12345');
    });

    test('falls back to the folder name when the branch has no key (e.g. detached HEAD)', () => {
      assert.strictEqual(findTicketKey([undefined, 'PROJ-777'], compileKeyPattern(DEFAULT_KEY_PATTERN)), 'PROJ-777');
      assert.strictEqual(findTicketKey(['main', 'feature-wt'], compileKeyPattern(DEFAULT_KEY_PATTERN)), undefined);
    });

    test('only matches whole tokens', () => {
      const pattern = compileKeyPattern(DEFAULT_KEY_PATTERN);
      assert.strictEqual(findTicketKey(['feature/xPROJ-12'], pattern), undefined);
      assert.strictEqual(findTicketKey(['feature/PROJ-12x'], pattern), undefined);
    });

    test('honours a custom pattern and falls back to the default when the pattern is invalid', () => {
      assert.strictEqual(findTicketKey(['feature/gh-42-thing'], compileKeyPattern('gh-\\d+')), 'gh-42');
      assert.strictEqual(findTicketKey(['fix/PROJ-9-x'], compileKeyPattern('([unclosed')), 'PROJ-9');
      assert.strictEqual(findTicketKey(['fix/PROJ-9-x'], compileKeyPattern('   ')), 'PROJ-9');
    });

    test('branchType is the first segment of a slashed branch', () => {
      assert.strictEqual(branchType('story/jd/PROJ-1-x'), 'story');
      assert.strictEqual(branchType('PROJ-1-x'), undefined);
      assert.strictEqual(branchType(undefined), undefined);
    });
  });

  suite('notes parsing', () => {
    test('reads summary, link, databases and test command from the known line shapes', () => {
      const notes = parseTicketNotes(SAMPLE_NOTES);
      assert.strictEqual(notes.key, 'PROJ-12345');
      assert.strictEqual(notes.summary, 'Fix CSV export timeout');
      assert.strictEqual(notes.rawTicketUrl, 'https://example.atlassian.net/browse/PROJ-12345');
      assert.deepStrictEqual(notes.devDatabases, ['app_proj_12345', 'app_logs_proj_12345']);
      assert.deepStrictEqual(notes.testDatabases, ['app_test_proj_12345', 'app_test_logs_hl_12345']);
      assert.strictEqual(notes.testCommand, 'DB_DATABASE=app_test_proj_12345 php83 artisan test --compact <path>');
    });

    test('ignores malformed content and drops database names that are not plain identifiers', () => {
      const notes = parseTicketNotes(['random text', '- Dev databases: `ok_db`, `bad; DROP`, `../x`', '- Tests: no backticks'].join('\n'));
      assert.strictEqual(notes.key, undefined);
      assert.strictEqual(notes.summary, undefined);
      assert.deepStrictEqual(notes.devDatabases, ['ok_db']);
      assert.strictEqual(notes.testCommand, undefined);
    });

    test('caps an overly long summary and handles CRLF line endings', () => {
      const notes = parseTicketNotes(`# PROJ-1: ${'x'.repeat(500)}\r\n- Jira: https://a.atlassian.net/browse/PROJ-1\r\n`);
      assert.strictEqual(notes.summary?.length, 200);
      assert.strictEqual(notes.rawTicketUrl, 'https://a.atlassian.net/browse/PROJ-1');
    });
  });

  suite('link validation', () => {
    test('accepts an https Atlassian link for the same key, rebuilt without query or fragment', () => {
      assert.strictEqual(
        validateTicketUrl('https://example.atlassian.net/browse/PROJ-1?x=1#y', 'PROJ-1', ''),
        'https://example.atlassian.net/browse/PROJ-1'
      );
    });

    test('rejects non-https, credentials, other hosts, other keys and other paths', () => {
      assert.strictEqual(validateTicketUrl('http://example.atlassian.net/browse/PROJ-1', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('javascript:alert(1)', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('https://user:pw@example.atlassian.net/browse/PROJ-1', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('https://evil.example/browse/PROJ-1', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('https://atlassian.net.evil.example/browse/PROJ-1', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('https://example.atlassian.net/browse/PROJ-2', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('https://example.atlassian.net/other/PROJ-1', 'PROJ-1', ''), undefined);
      assert.strictEqual(validateTicketUrl('not a url', 'PROJ-1', ''), undefined);
    });

    test("accepts the URL template's own host", () => {
      assert.strictEqual(
        validateTicketUrl('https://tracker.example/browse/PROJ-1', 'PROJ-1', 'https://tracker.example/browse/{key}'),
        'https://tracker.example/browse/PROJ-1'
      );
    });

    test('builds a link from an https template only', () => {
      assert.strictEqual(urlFromTemplate('https://tracker.example/browse/{key}', 'PROJ-1'), 'https://tracker.example/browse/PROJ-1');
      assert.strictEqual(urlFromTemplate('http://tracker.example/browse/{key}', 'PROJ-1'), undefined);
      assert.strictEqual(urlFromTemplate('https://tracker.example/browse/', 'PROJ-1'), undefined);
      assert.strictEqual(urlFromTemplate('', 'PROJ-1'), undefined);
    });
  });

  test('notes file name must be a bare file name', () => {
    assert.ok(isSafeNotesFileName('CLAUDE.local.md'));
    assert.ok(!isSafeNotesFileName('../secrets.md'));
    assert.ok(!isSafeNotesFileName('sub/notes.md'));
    assert.ok(!isSafeNotesFileName('/etc/passwd'));
    assert.ok(!isSafeNotesFileName('..'));
    assert.ok(!isSafeNotesFileName(''));
  });

  suite('buildTicketMetadata', () => {
    const notesUri = vscode.Uri.file('/wt/CLAUDE.local.md');

    test('combines the branch key with matching notes', () => {
      const metadata = buildTicketMetadata(
        { branch: 'fix/jd/PROJ-12345-csv-export-timeout', notes: parseTicketNotes(SAMPLE_NOTES), notesUri },
        config
      );
      assert.ok(metadata);
      assert.strictEqual(metadata.key, 'PROJ-12345');
      assert.strictEqual(metadata.branchType, 'fix');
      assert.strictEqual(metadata.summary, 'Fix CSV export timeout');
      assert.strictEqual(metadata.ticketUrl, 'https://example.atlassian.net/browse/PROJ-12345');
      assert.strictEqual(metadata.notesUri?.toString(), notesUri.toString());
    });

    test('ignores notes written for a different ticket', () => {
      const metadata = buildTicketMetadata({ branch: 'fix/jd/PROJ-99-x', notes: parseTicketNotes(SAMPLE_NOTES), notesUri }, config);
      assert.ok(metadata);
      assert.strictEqual(metadata.key, 'PROJ-99');
      assert.strictEqual(metadata.summary, undefined);
      assert.strictEqual(metadata.ticketUrl, undefined);
      assert.strictEqual(metadata.notesUri, undefined);
    });

    test('falls back to the URL template when the notes have no valid link', () => {
      const metadata = buildTicketMetadata(
        { branch: 'story/PROJ-5-x' },
        { ...config, urlTemplate: 'https://tracker.example/browse/{key}' }
      );
      assert.strictEqual(metadata?.ticketUrl, 'https://tracker.example/browse/PROJ-5');
    });

    test('returns undefined when no key can be found', () => {
      assert.strictEqual(buildTicketMetadata({ branch: 'main', folderName: 'web-application' }, config), undefined);
    });
  });
});
