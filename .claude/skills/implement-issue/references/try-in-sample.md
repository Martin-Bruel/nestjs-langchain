# Try a change in a sample

The samples are npm workspaces: `node_modules/nestjs-langchain` links to the repository root, so
a sample imports the freshly built `dist/` like a real user would. They are the ESM Nest apps
`nest new` generates on NestJS 12, built by the Nest CLI.

Reuse what the sample already has (its services, its tool modules), and replace only what needs
an outside service: the model, and MongoDB for `samples/agent`.

## Steps

1. Build the library: `npm run build` (the sample reads `dist/`, not `lib/`).
2. Write the scenario in `samples/<sample>/src/scratch/<name>.ts` (git-ignored). Pick the sample
   closest to the change: `agent` for tools and named agents (`MathModule` needs nothing
   external, `MongoModule` needs a database: do not use it), `chat` for the plain agent.
3. Build and run it with the sample's own toolchain:
   ```bash
   cd samples/<sample> && npx nest build && node dist/scratch/<name>.js
   ```
   A type error reported by `nest build` is a finding even when the script still runs: a user
   compiling their app hits it.
4. Try the intended use, then the misuse the change guards against (the error, its message).
5. Report what ran and what it printed. Delete `src/scratch/` and `dist/scratch/` afterwards.

## Skeleton

```ts
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FakeListChatModel } from '@langchain/core/utils/testing';
import { Agent, LangChainModule } from 'nestjs-langchain';
import { MathModule } from '../math/math.module.js';

@Module({
  imports: [
    MathModule,
    LangChainModule.register({
      model: new FakeListChatModel({ responses: ['42'] }),
      tools: [MathModule],
    }),
  ],
})
class ScratchModule {}

const app = await NestFactory.createApplicationContext(ScratchModule, { logger: false });
console.log(await app.get(Agent).run('6 * 7 ?'));
await app.close();
```

The scenario builds its own module rather than overriding `AppModule`: the registration is the
thing under test, and `AppModule` wires a real provider and MongoDB.

## Known limits

- A scenario that asserts can be a `src/scratch/<name>.spec.ts` instead, run by the sample's
  Vitest: `npx vitest run src/scratch`.
- A real provider only with the user's agreement (key, cost).
- The samples are ESM only. A CommonJS consumer is covered by `npm run verify:package`.
