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

console.log(`Git fixture ready: ${mainRepo}`);
console.log(`  linked worktree:   ${linkedWorktree}`);
console.log(`  detached worktree: ${detachedWorktree}`);
