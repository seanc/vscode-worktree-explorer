// PRD §10.4: extension-specific glob exclusions (default "**/.git", "**/node_modules"), applied
// without touching global VS Code settings.
//
// Supports only the "**/<name-glob>" shape (matched against an entry's basename, * and ? as
// wildcards) — the only pattern shape the PRD's own default and documented examples use. Broader
// glob support (partial paths, {a,b} groups, etc.) is a documented simplification, not a full
// glob engine; revisit if a real need for more surfaces during hardening (#13).
export function compileExcludeMatcher(patterns: Readonly<Record<string, boolean>>): (name: string) => boolean {
  const basenameRegexes = Object.entries(patterns)
    .filter(([pattern, enabled]) => enabled && pattern.startsWith('**/'))
    .map(([pattern]) => globToRegExp(pattern.slice(3)));

  return (name: string) => basenameRegexes.some((regex) => regex.test(name));
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`);
}
