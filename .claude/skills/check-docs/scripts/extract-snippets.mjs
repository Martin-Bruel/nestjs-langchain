/**
 * Extracts the code blocks of a Markdown file into a project that typechecks
 * them against the sources in `lib/`.
 *
 * Each ```ts block becomes `<outDir>/<NN>-<section>.ts`, headed by a comment
 * pointing back to its line. A `tsconfig.json` maps `nestjs-langchain` to
 * `lib/index.ts`, and a `vitest.config.ts` runs the `*.spec.ts` written next to
 * them with the same mapping. Every block, whatever its language, is listed in
 * `<outDir>/manifest.json` and printed as a summary.
 *
 * outDir must sit inside the repository, so the snippets resolve its
 * `node_modules`.
 *
 * Usage: node .claude/skills/check-docs/scripts/extract-snippets.mjs [README.md] [.claude/tmp/docs]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../../..');
const source = resolve(root, process.argv[2] ?? 'README.md');
const outDir = resolve(root, process.argv[3] ?? '.claude/tmp/docs');

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'top';

const lines = readFileSync(source, 'utf8').split('\n');
const blocks = [];
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
    open = { lang: fence[1] || 'text', line: index + 1, section, code: [] };
    return;
  }
  const heading = line.match(/^#{1,6}\s+(.*)/);
  if (heading) section = heading[1].trim();
});
if (open) {
  console.error(`unclosed code fence opened at line ${open.line}`);
  process.exitCode = 1;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const manifest = blocks.map((block, index) => {
  const entry = {
    index: index + 1,
    lang: block.lang,
    line: block.line,
    section: block.section,
  };
  if (block.lang === 'ts' || block.lang === 'typescript') {
    const file = `${String(index + 1).padStart(2, '0')}-${slug(block.section)}.ts`;
    const header = `// ${relative(root, source)}:${block.line} — ${block.section}\n`;
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
  console.log(
    `${String(entry.line).padStart(4)}  ${entry.section}  →  ${target}`,
  );
}
console.log(
  `\n${manifest.filter((e) => e.file).length} ts blocks in ${relative(root, outDir)}/`,
);
const dir = relative(root, outDir);
console.log(`typecheck: npx tsc -p ${dir}`);
console.log(`run:       npx vitest run --config ${dir}/vitest.config.ts`);
