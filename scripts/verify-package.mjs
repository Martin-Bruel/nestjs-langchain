/**
 * Packs the library and installs the tarball into throwaway consumer projects,
 * one CommonJS and one ESM, then boots each one.
 *
 * `publint` and `attw` already check the manifest and how types resolve, and
 * they do it across more module resolution modes than a consumer project could.
 * This covers what they cannot: that the peer range actually resolves without
 * --force, that the published build runs, and that a consumer's own model
 * instance typechecks against the published types (#169). The suite in `tests/`
 * imports the sources, so nothing else ever executes what npm ships.
 *
 * With `pnpm`, the consumers install through pnpm's isolated layout instead,
 * where a package reaches only what it declares. That is what catches an import
 * the manifest never mentions, which npm's flat `node_modules` resolves anyway.
 *
 * Usage: node scripts/verify-package.mjs <nestjs-major> [npm|pnpm]
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const nest = process.argv[2] ?? '11';
const pm = process.argv[3] ?? 'npm';
if (pm !== 'npm' && pm !== 'pnpm') {
  console.error(`unknown package manager: ${pm}`);
  process.exit(1);
}
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
import { LangChainModule, Agent } from 'nestjs-langchain';`
    : `const { Test } = require('@nestjs/testing');
const { FakeListChatModel } = require('@langchain/core/utils/testing');
const { LangChainModule, Agent } = require('nestjs-langchain');`
}

const main = async () => {
  const app = await Test.createTestingModule({
    imports: [LangChainModule.register({ model: new FakeListChatModel({ responses: ['42'] }) })],
  }).compile();
  await app.init();

  const { status, output } = await app.get(Agent).run('question');
  if (status !== 'completed' || output !== '42') throw new Error('expected a completed run answering 42, got ' + output);
  await app.close();
  console.log('  boots and answers');
};

main().catch((error) => {
  console.error('  ' + error.message);
  process.exit(1);
});
`;

// Type-checked, never run. Each consumer imports its model through its own
// module system, so a CommonJS one gets `@langchain/core`'s `.d.cts` while
// this package's declarations see the `.d.ts`: the two must still agree.
const typecheck = `
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { LangChainModule, ModelOption } from 'nestjs-langchain';

const model: ModelOption = new FakeListChatModel({ responses: ['42'] });

LangChainModule.register({ model });
LangChainModule.registerAsync({ useFactory: () => ({ model }) });
`;

const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

// Built here rather than assumed: `npm pack` ships whatever is in `dist`, so a
// stale directory would silently verify the previous version.
console.log(
  `Building, packing, then installing into ${pm} consumers on NestJS ${nest}`,
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
    const types = kind === 'esm' ? 'typecheck.mts' : 'typecheck.cts';
    writeFileSync(join(dir, types), typecheck);

    // No --force and no --legacy-peer-deps: an ERESOLVE here means the peer
    // range does not really accept this NestJS major.
    //
    // hoist=false is what makes the pnpm run worth anything. Left on, its
    // default, pnpm mirrors every package into `.pnpm/node_modules`, which sits
    // on the resolution path of every isolated package, so an undeclared import
    // resolves there and the run passes. Measured on a tarball carrying one.
    run(
      pm,
      [
        ...(pm === 'pnpm'
          ? ['add', '--config.hoist=false']
          : ['install', '--no-audit', '--no-fund']),
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

    run(
      'node',
      [
        tsc,
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        types,
      ],
      dir,
    );
    console.log('  typechecks a model instance');
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
