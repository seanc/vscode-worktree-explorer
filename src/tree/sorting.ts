import type { FileSystemEntry } from '../filesystem';
import { isDirectory } from '../filesystem';

export type SortOrder = 'foldersFirst' | 'mixed' | 'filesFirst';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** PRD §10.2: directories-first (or last) by default, case-insensitive locale-aware name, URI as
 *  a stable tie-breaker. */
export function sortEntries(entries: readonly FileSystemEntry[], order: SortOrder): FileSystemEntry[] {
  return [...entries].sort((a, b) => {
    if (order !== 'mixed') {
      const aIsDir = isDirectory(a.type);
      const bIsDir = isDirectory(b.type);
      if (aIsDir !== bIsDir) {
        const dirsFirst = order === 'foldersFirst';
        if (aIsDir) {
          return dirsFirst ? -1 : 1;
        }
        return dirsFirst ? 1 : -1;
      }
    }
    const nameComparison = collator.compare(a.name, b.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }
    const aUri = a.uri.toString();
    const bUri = b.uri.toString();
    return aUri < bUri ? -1 : aUri > bUri ? 1 : 0;
  });
}
