// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        { selector: 'import', format: ['camelCase', 'PascalCase'] }
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      curly: 'warn',
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      semi: 'warn'
    }
  },
  {
    // #25: plain browser scripts for the ticket webviews (no build step, no dependencies).
    files: ['media/**/*.js'],
    languageOptions: { sourceType: 'script' },
    rules: {
      curly: 'warn',
      eqeqeq: 'warn',
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Webview content is built with textContent only.' },
        { property: 'outerHTML', message: 'Webview content is built with textContent only.' },
        { property: 'insertAdjacentHTML', message: 'Webview content is built with textContent only.' }
      ],
      'no-restricted-globals': ['error', 'eval', 'fetch', 'XMLHttpRequest', 'WebSocket']
    }
  },
  {
    ignores: ['dist/**', 'out/**', '.vscode-test/**', 'esbuild.js', 'test/setup/**']
  }
);
