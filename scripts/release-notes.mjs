/**
 * The section of `CHANGELOG.md` for one version, without its heading: the
 * notes of that version's GitHub Release. Fails when the changelog has no such
 * section, so a release never goes out with empty notes.
 *
 * Usage: node scripts/release-notes.mjs <version>
 */
import { readFileSync } from 'node:fs';

const [version] = process.argv.slice(2);

if (!version) {
  throw new Error('Usage: node scripts/release-notes.mjs <version>');
}

const lines = readFileSync(
  new URL('../CHANGELOG.md', import.meta.url),
  'utf8',
).split('\n');

// `## [2.0.0](compare link) (date)`, as the changelog writer formats it.
const heading = (line) => /^## \[?([^\]\s]+)\]?/.exec(line)?.[1];

const start = lines.findIndex((line) => heading(line) === version);

if (start === -1) {
  throw new Error(`CHANGELOG.md has no section for ${version}`);
}

const next = lines.findIndex(
  (line, index) => index > start && line.startsWith('## '),
);
const section = lines.slice(start + 1, next === -1 ? undefined : next);

process.stdout.write(`${section.join('\n').trim()}\n`);
