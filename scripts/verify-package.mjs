/**
 * Packs the library and installs the tarball into throwaway consumer projects,
 * one CommonJS and one ESM, then type-checks and boots each one.
 *
 * `publint` and `attw` already check the manifest and how types resolve, and
 * they do it across more module resolution modes than a consumer project could.
 * This covers the two things they cannot: that the peer range actually resolves
 * without --force, and that the published build runs. The suite in `tests/`
 * imports the sources, so nothing else ever executes what npm ships.
 *
 * Usage: node scripts/verify-package.mjs <nestjs-major>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const nest = process.argv[2] ?? '11';
const root = resolve(import.meta.dirname, '..');

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

// Run, never type-checked. `require` on one side and `import` on the other is
// the whole point: the CommonJS path only works through Node's require(esm).
const smoke = (kind) => `
${kind === 'esm' ? "import 'reflect-metadata';" : "require('reflect-metadata');"}
${
  kind === 'esm'
    ? `import { Test } from '@nestjs/testing';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, LangChainService } from 'nestjs-langchain';`
    : `const { Test } = require('@nestjs/testing');
const { FakeListChatModel } = require('@langchain/core/utils/testing');
const { LangChainModule, LangChainService } = require('nestjs-langchain');`
}

const main = async () => {
  const app = await Test.createTestingModule({
    imports: [LangChainModule.register({ model: new FakeListChatModel({ responses: ['42'] }) })],
  }).compile();
  await app.init();

  const answer = await app.get(LangChainService).run('question');
  if (answer !== '42') throw new Error('expected 42, got ' + answer);
  await app.close();
  console.log('  boots and answers');
};

main().catch((error) => {
  console.error('  ' + error.message);
  process.exit(1);
});
`;

// Built here rather than assumed: `npm pack` ships whatever is in `dist`, so a
// stale directory would silently verify the previous version.
console.log(
  `Building, packing, then installing into consumers on NestJS ${nest}`,
);
run('npm', ['run', 'build'], root);
const tarball = join(root, run('npm', ['pack', '--silent'], root).trim());

let failed = false;
for (const kind of ['cjs', 'esm']) {
  const dir = mkdtempSync(join(tmpdir(), `consumer-${kind}-`));
  const entry = kind === 'esm' ? 'smoke.mjs' : 'smoke.cjs';
  console.log(`\n${kind.toUpperCase()} consumer`);
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: `consumer-${kind}`,
        version: '1.0.0',
        private: true,
        ...(kind === 'esm' ? { type: 'module' } : {}),
      }),
    );
    writeFileSync(join(dir, entry), smoke(kind));

    // No --force and no --legacy-peer-deps: an ERESOLVE here means the peer
    // range does not really accept this NestJS major.
    run(
      'npm',
      [
        'install',
        '--no-audit',
        '--no-fund',
        tarball,
        `@nestjs/common@^${nest}`,
        `@nestjs/core@^${nest}`,
        `@nestjs/testing@^${nest}`,
        'reflect-metadata',
        'rxjs',
        '@langchain/core',
        'langchain',
      ],
      dir,
    );
    console.log('  installs, peer range accepted');

    process.stdout.write(run('node', [entry], dir));
  } catch (error) {
    failed = true;
    console.error(
      `  FAILED\n${error.stdout ?? ''}${error.stderr ?? error.message}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

rmSync(tarball, { force: true });
process.exit(failed ? 1 : 0);
