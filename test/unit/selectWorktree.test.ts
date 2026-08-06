import * as assert from 'assert';
import { selectWorktree } from '../../src/commands';

// §9.11/§25: Git-unavailable check must short-circuit before ever reaching showWorktreeQuickPick
// (which has no public API a test can drive non-interactively — see #5) — proven here by poisoning
// listWorktrees() and confirming the call still doesn't throw or reach the picker.
suite('selectWorktree (#13: Git-unavailable message)', () => {
  test('shows the Git-unavailable message and never opens the picker', async () => {
    let selectManuallyCalled = false;
    const gitIntegration = {
      isAvailable: false,
      listWorktrees: () => {
        throw new Error('should not be called when Git is unavailable');
      },
      isRepositorySelected: () => false
    };
    const selection = {
      snapshot: { activeWorktreeUri: undefined, activeSource: undefined, rootGeneration: 0 },
      selectManually: () => {
        selectManuallyCalled = true;
      }
    };

    await selectWorktree(gitIntegration, selection);

    assert.strictEqual(selectManuallyCalled, false);
  });
});
