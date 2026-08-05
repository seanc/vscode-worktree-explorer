import { defineConfig } from '@vscode/test-cli';

// Three suites, each with its own workspace folder:
// - unitTests: pure logic, no fixture required.
// - integrationTests: generic extension-lifecycle checks against the empty test/fixtures folder.
// - gitDiscoveryTests: live checks against a real generated Git repo + linked worktree
//   (test/setup/createGitFixture.js, run by `pretest`), isolated under test/integration/git/ so
//   its glob doesn't overlap with integrationTests'.
export default defineConfig([
  {
    label: 'unitTests',
    files: 'out/test/unit/**/*.test.js',
    mocha: { timeout: 20000 }
  },
  {
    label: 'integrationTests',
    files: 'out/test/integration/*.test.js',
    workspaceFolder: './test/fixtures',
    mocha: { timeout: 20000 }
  },
  {
    label: 'gitDiscoveryTests',
    files: 'out/test/integration/git/**/*.test.js',
    workspaceFolder: './test/fixtures/git-linked-worktree/main',
    mocha: { timeout: 30000 }
  }
]);
