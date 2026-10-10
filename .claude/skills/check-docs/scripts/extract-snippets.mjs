/**
 * Extracts the code blocks of Markdown files into a project that typechecks
 * them against the sources in `lib/`.
 *
 * Each ```ts block becomes `<outDir>/<NN>-<file>-<section>.ts`, headed by a
 * comment pointing back to its file and line. A `tsconfig.json` maps
 * `nestjs-langchain` to `lib/index.ts`, and a `vitest.config.ts` runs the
 * `*.spec.ts` written next to them with the same mapping. Every block, whatever
 * its language, is listed in `<outDir>/manifest.json` and printed as a summary.
 *
 * The `.md` arguments are the files to read, `README.md` and every page of
 * `docs/` by default; any other argument is outDir. outDir must sit inside the
 * repository, so the snippets resolve its `node_modules`.
 *
 * Usage: node .claude/skills/check-docs/scripts/extract-snippets.mjs [file.md ...] [.claude/tmp/docs]
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../..');
const args = process.argv.slice(2);
const pages = existsSync(join(root, 'docs'))
  ? readdirSync(join(root, 'docs'))
      .filter((file) => file.endsWith('.md'))
      .sort()
      .map((file) => `docs/${file}`)
  : [];
const named = args.filter((arg) => arg.endsWith('.md'));
const sources = (named.length > 0 ? named : ['README.md', ...pages]).map(
  (file) => resolve(root, file),
);
const outDir = resolve(
  root,
  args.find((arg) => !arg.endsWith('.md')) ?? '.claude/tmp/docs',
);

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'top';

const blocks = [];

for (const source of sources) {
  const lines = readFileSync(source, 'utf8').split('\n');
  const file = relative(root, source);
  let section = 'top';
  let open = null;

  lines.forEach((line, index) => {
    const fence = line.match(/^\s*```(\S*)/);
    if (open) {
      if (fence && fence[1] === '') {
        blocks.push(open);
        open = null;
      } else {
        open.code.push(line);
      }
      return;
    }
    if (fence) {
      const lang = fence[1] || 'text';
      open = { file, lang, line: index + 1, section, code: [] };
      return;
    }
    const heading = line.match(/^#{1,6}\s+(.*)/);
    if (heading) section = heading[1].trim();
  });
  if (open) {
    console.error(`${file}: unclosed code fence opened at line ${open.line}`);
    process.exitCode = 1;
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const manifest = blocks.map((block, index) => {
  const entry = {
    index: index + 1,
    source: block.file,
    lang: block.lang,
    line: block.line,
    section: block.section,
  };
  if (block.lang === 'ts' || block.lang === 'typescript') {
    const name = slug(block.file.replace(/\.md$/, ''));
    const file = `${String(index + 1).padStart(2, '0')}-${name}-${slug(block.section)}.ts`;
    const header = `// ${block.file}:${block.line} — ${block.section}\n`;
    writeFileSync(join(outDir, file), header + block.code.join('\n') + '\n');
    entry.file = file;
  } else {
    entry.code = block.code.join('\n');
  }
  return entry;
});

const lib = relative(outDir, join(root, 'lib/index.ts'));
writeFileSync(
  join(outDir, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: relative(outDir, join(root, 'tsconfig.json')),
      compilerOptions: {
        noEmit: true,
        rootDir: relative(outDir, root),
        paths: { 'nestjs-langchain': [lib] },
      },
      include: ['*.ts'],
    },
    null,
    2,
  ) + '\n',
);
// The root config only includes lib/ and tests/, and Vitest ignores `paths`.
writeFileSync(
  join(outDir, 'vitest.config.ts'),
  `import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: here('.'),
  resolve: { alias: { 'nestjs-langchain': here('${lib}') } },
  test: { globals: true, environment: 'node', include: ['*.spec.ts'] },
});
`,
);
writeFileSync(
  join(outDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);

for (const entry of manifest) {
  const target = entry.file ?? `(${entry.lang}, not extracted)`;
  console.log(`${entry.source}:${entry.line}  ${entry.section}  →  ${target}`);
}
console.log(
  `\n${manifest.filter((e) => e.file).length} ts blocks in ${relative(root, outDir)}/`,
);
const dir = relative(root, outDir);
console.log(`typecheck: npx tsc -p ${dir}`);
console.log(`run:       npx vitest run --config ${dir}/vitest.config.ts`);
