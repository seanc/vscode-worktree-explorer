// Generates a real Git repository with a linked worktree, a detached worktree, a nested
// directory, and a symlink for the live-discovery/browsing integration tests (PRD §28.2
// "temporary Git fixtures", §28.2 scenarios: one linked worktree, detached worktree, nested
// directories and symlinks). Regenerated on every `npm test` run via `pretest`; the output
// directory is gitignored, not committed.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'fixtures', 'git-linked-worktree');
const mainRepo = path.join(root, 'main');
const linkedWorktree = path.join(root, 'linked-wt');
const detachedWorktree = path.join(root, 'detached-wt');
const ticketWorktree = path.join(root, 'ticket-wt');
const stackedWorktree = path.join(root, 'stacked-wt');
const mergedWorktree = path.join(root, 'merged-wt');

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
}

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(mainRepo, { recursive: true });

git(mainRepo, 'init', '-q', '-b', 'main');
git(mainRepo, 'config', 'user.email', 'worktree-explorer-tests@example.com');
git(mainRepo, 'config', 'user.name', 'Worktree Explorer Tests');
fs.writeFileSync(path.join(mainRepo, 'README.md'), 'Live git fixture for issue #3.\n');

// #14/§28.2 "nested directories and symlinks": a nested file plus a symlink pointing at that
// nested directory, both inside the tracked tree.
fs.mkdirSync(path.join(mainRepo, 'sub', 'nested'), { recursive: true });
fs.writeFileSync(path.join(mainRepo, 'sub', 'nested', 'file.txt'), 'nested file\n');
try {
  fs.symlinkSync(path.join(mainRepo, 'sub'), path.join(mainRepo, 'sub-link'), process.platform === 'win32' ? 'junction' : 'dir');
} catch (error) {
  // Directory symlinks need elevation/Developer Mode on Windows without either; the tree-browsing
  // test that depends on this checks for the link's existence and skips itself if absent, the
  // same pattern used in rootBoundaryGuard.test.ts.
  console.log(`Symlink fixture skipped (${error.code ?? error.message}); dependent tests will skip themselves.`);
}

git(mainRepo, 'add', '.');
git(mainRepo, 'commit', '-q', '-m', 'initial commit');

git(mainRepo, 'worktree', 'add', '-q', '-b', 'feature/x', linkedWorktree);

const headCommit = git(mainRepo, 'rev-parse', 'HEAD');
git(mainRepo, 'worktree', 'add', '-q', '--detach', detachedWorktree, headCommit);

// #17/#18: a ticket-style worktree — one commit ahead of main, one uncommitted modification, one
// untracked file, and a notes file in the shape a start-ticket workflow writes (kept untracked).
git(mainRepo, 'worktree', 'add', '-q', '-b', 'feature/jd/TEST-1-sample', ticketWorktree);
git(ticketWorktree, 'config', 'user.email', 'worktree-explorer-tests@example.com');
git(ticketWorktree, 'config', 'user.name', 'Worktree Explorer Tests');
fs.writeFileSync(path.join(ticketWorktree, 'feature.txt'), 'committed on the ticket branch\n');
git(ticketWorktree, 'add', 'feature.txt');
git(ticketWorktree, 'commit', '-q', '-m', 'ticket work');
fs.appendFileSync(path.join(ticketWorktree, 'README.md'), 'uncommitted change\n');
fs.writeFileSync(path.join(ticketWorktree, 'scratch.txt'), 'untracked\n');
fs.writeFileSync(
  path.join(ticketWorktree, 'CLAUDE.local.md'),
  [
    '# TEST-1: Sample ticket for the fixture',
    '',
    '- Jira: https://example.atlassian.net/browse/TEST-1',
    '- Dev databases (clones, this worktree only): `app_test_1`',
    '- Test databases: `app_testing_test_1`',
    '- Tests: `DB_DATABASE=app_testing_test_1 php artisan test --compact <path>`.',
    ''
  ].join('\n')
);
fs.appendFileSync(path.join(mainRepo, '.git', 'info', 'exclude'), 'CLAUDE.local.md\n');

// #23: a stacked worktree, branched from another feature branch (reflog: "Created from feature/x").
git(mainRepo, 'worktree', 'add', '-q', '-b', 'feature/jd/TEST-3-stacked', stackedWorktree, 'feature/x');

// #24: a ticket whose work already landed on main as a squash commit mentioning its key.
git(mainRepo, 'worktree', 'add', '-q', '-b', 'feature/jd/TEST-2-done', mergedWorktree);
fs.writeFileSync(path.join(mainRepo, 'done.txt'), 'squash-merged ticket work\n');
git(mainRepo, 'add', 'done.txt');
git(mainRepo, 'commit', '-q', '-m', 'TEST-2 Finish the done thing (#5)');

console.log(`Git fixture ready: ${mainRepo}`);
console.log(`  linked worktree:   ${linkedWorktree}`);
console.log(`  detached worktree: ${detachedWorktree}`);
console.log(`  ticket worktree:   ${ticketWorktree}`);
