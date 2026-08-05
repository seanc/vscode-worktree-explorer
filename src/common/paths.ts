// Shared, platform-appropriate path comparison. RootBoundaryGuard (#8) is the *authoritative*
// consumer for mutation safety; src/git's discovery-time worktree-to-repository matching uses the
// same normalization but is not itself a security boundary.
const CASE_INSENSITIVE_PLATFORM = process.platform === 'win32' || process.platform === 'darwin';

export function normalizePathForComparison(fsPath: string): string {
  const withForwardSlashes = process.platform === 'win32' ? fsPath.replace(/\\/g, '/') : fsPath;
  return CASE_INSENSITIVE_PLATFORM ? withForwardSlashes.toLowerCase() : withForwardSlashes;
}

export function pathsEqual(a: string, b: string): boolean {
  return normalizePathForComparison(a) === normalizePathForComparison(b);
}

/** True if `candidateFsPath` is `ancestorFsPath` itself or lies underneath it. */
export function isDescendantPath(ancestorFsPath: string, candidateFsPath: string): boolean {
  const ancestor = normalizePathForComparison(ancestorFsPath).replace(/\/+$/, '');
  const candidate = normalizePathForComparison(candidateFsPath);
  return candidate === ancestor || candidate.startsWith(`${ancestor}/`);
}
