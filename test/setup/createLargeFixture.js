// Generates a large synthetic directory tree for #15's performance profiling — not used by the
// regular test suite (only by `npm run profile`), so it doesn't slow down or destabilize CI.
// Not committed (gitignored, like the other generated fixtures).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'fixtures', 'large-tree');
const FLAT_FILE_COUNT = 2000;
const NESTED_DIR_COUNT = 500;
const FILES_PER_NESTED_DIR = 5;

fs.rmSync(root, { recursive: true, force: true });

// A single large flat directory — the direct stress case for PRD §23's "<500 entries visible
// within 200ms" target, scaled well past it to see where the cost curve actually sits.
const flatDir = path.join(root, 'flat');
fs.mkdirSync(flatDir, { recursive: true });
for (let i = 0; i < FLAT_FILE_COUNT; i += 1) {
  fs.writeFileSync(path.join(flatDir, `file-${String(i).padStart(5, '0')}.txt`), '');
}

// A deep/wide nested tree — since WorktreeTreeProvider only lists an expanded node's direct
// children (PRD §10.1 lazy loading), the root's own listing should stay cheap regardless of how
// large the tree is below it; this fixture exists to prove that, not to stress a single directory.
const nestedRoot = path.join(root, 'nested');
for (let i = 0; i < NESTED_DIR_COUNT; i += 1) {
  const dir = path.join(nestedRoot, `dir-${String(i).padStart(4, '0')}`);
  fs.mkdirSync(dir, { recursive: true });
  for (let f = 0; f < FILES_PER_NESTED_DIR; f += 1) {
    fs.writeFileSync(path.join(dir, `file-${f}.txt`), '');
  }
}

console.log(`Large fixture ready: ${root}`);
console.log(`  flat/   : ${FLAT_FILE_COUNT} files in one directory`);
console.log(`  nested/ : ${NESTED_DIR_COUNT} directories x ${FILES_PER_NESTED_DIR} files`);
