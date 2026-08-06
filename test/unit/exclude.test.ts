import * as assert from 'assert';
import { compileExcludeMatcher } from '../../src/tree';

suite('compileExcludeMatcher', () => {
  test('PRD §10.4 default: excludes .git and node_modules by basename', () => {
    const isExcluded = compileExcludeMatcher({ '**/.git': true, '**/node_modules': true });
    assert.strictEqual(isExcluded('.git'), true);
    assert.strictEqual(isExcluded('node_modules'), true);
    assert.strictEqual(isExcluded('src'), false);
  });

  test('a disabled pattern does not exclude anything', () => {
    const isExcluded = compileExcludeMatcher({ '**/.git': false });
    assert.strictEqual(isExcluded('.git'), false);
  });

  test('supports * and ? wildcards', () => {
    const isExcluded = compileExcludeMatcher({ '**/*.log': true, '**/file?.tmp': true });
    assert.strictEqual(isExcluded('debug.log'), true);
    assert.strictEqual(isExcluded('file1.tmp'), true);
    assert.strictEqual(isExcluded('file12.tmp'), false);
    assert.strictEqual(isExcluded('readme.md'), false);
  });

  test('patterns not shaped "**/<glob>" are ignored (documented simplification)', () => {
    const isExcluded = compileExcludeMatcher({ 'src/generated': true });
    assert.strictEqual(isExcluded('generated'), false);
  });
});
