import { defineConfig } from '@vscode/test-cli';

// #15: performance profiling against a large synthetic tree (test/setup/createLargeFixture.js).
// Deliberately a separate config file from .vscode-test.mjs, not another entry in its array —
// `vscode-test` with no arguments runs every config found in the default .vscode-test.mjs, and
// this fixture is intentionally not part of `pretest`, so folding it in there would break a plain
// `npm test`/CI run against a workspaceFolder that was never generated. Logs timings for manual
// comparison against PRD §23's targets rather than hard-asserting them, since dev/CI machine speed
// varies too much for a reliable pass/fail gate. Run via `npm run profile`.
export default defineConfig([
  {
    label: 'perfTests',
    files: 'out/test/perf/**/*.test.js',
    workspaceFolder: './test/fixtures/large-tree',
    mocha: { timeout: 60000 }
  }
]);
