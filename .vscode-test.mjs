import { defineConfig } from '@vscode/test-cli';

// Both suites run through the real Extension Development Host (@vscode/test-cli). Standardizing on
// one test toolchain for #1; splitting pure-logic unit tests into a lighter runner is a later
// optimization if Electron-host startup cost becomes noticeable (see docs/issues/001-*.md).
export default defineConfig([
  {
    label: 'unitTests',
    files: 'out/test/unit/**/*.test.js',
    mocha: { timeout: 20000 }
  },
  {
    label: 'integrationTests',
    files: 'out/test/integration/**/*.test.js',
    workspaceFolder: './test/fixtures',
    mocha: { timeout: 20000 }
  }
]);
