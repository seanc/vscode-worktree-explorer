// Generates a real Git repository with one linked worktree for the #3 live-discovery integration
// test (PRD §28.2 "temporary Git fixtures"). Regenerated on every `npm test` run via `pretest`;
// the output directory is gitignored, not committed.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'fixtures', 'git-linked-worktree');
const mainRepo = path.join(root, 'main');
const linkedWorktree = path.join(root, 'linked-wt');

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, stdio: 'pipe' });
}

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(mainRepo, { recursive: true });

git(mainRepo, 'init', '-q', '-b', 'main');
git(mainRepo, 'config', 'user.email', 'worktree-explorer-tests@example.com');
git(mainRepo, 'config', 'user.name', 'Worktree Explorer Tests');
fs.writeFileSync(path.join(mainRepo, 'README.md'), 'Live git fixture for issue #3.\n');
git(mainRepo, 'add', '.');
git(mainRepo, 'commit', '-q', '-m', 'initial commit');
git(mainRepo, 'worktree', 'add', '-q', '-b', 'feature/x', linkedWorktree);

console.log(`Git fixture ready: ${mainRepo} (+ linked worktree at ${linkedWorktree})`);
