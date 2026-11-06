# Setup

This page details [Installation](../README.md#installation),
[Async Configuration](../README.md#async-configuration) and [Testing](../README.md#testing).

## Requirements

| | |
|---|---|
| Node | 22.12 or later |
| NestJS | 11.1.18 or later, or 12.0.1 or later |
| `langchain` | 1.5.4 or later, with `@langchain/core` 1.2.3 or later |
| Zod | 4 |
| TypeScript | 5.8 or later |

The package is ESM only. A CommonJS application loads it through Node's `require(esm)`, available
from Node 22.12, and TypeScript accepts it from 5.8, with `module` set to `nodenext`.

## Testing with Jest

Jest loads this ESM-only package into a CommonJS application from Node 24.9 only: below, it fails
with `Must use import to load ES Module`. Run Jest on Node 24.9 or later, or test with Vitest.

## registerAsync

`registerAsync` builds the options from other providers, through `useFactory`, `useClass` or
`useExisting`. `name` stays at its root, outside the factory: it names the token `@InjectAgent()`
resolves, which Nest needs before any factory runs.

`useClass` and `useExisting` take a class implementing `LangChainOptionsFactory`. Declare its
method's return type, so that a key the options do not declare is rejected:

```ts
import { Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  LangChainModule,
  LangChainModuleOptions,
  LangChainOptionsFactory,
} from 'nestjs-langchain';

@Injectable()
class MathAgentOptions implements LangChainOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createLangChainOptions(): LangChainModuleOptions {
    return {
      model: {
        model: 'openai:gpt-5-mini',
        apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
      },
      tools: [MathModule],
    };
  }
}

@Module({
  imports: [
    MathModule,
    LangChainModule.registerAsync({
      name: 'MATH_AGENT',
      imports: [ConfigModule],
      useClass: MathAgentOptions,
    }),
  ],
})
export class AppModule {}
```

## Global agents

An agent is visible to the module that registers it. `isGlobal` makes that module global, so the
agent it exports is injectable from any other module, which does not import `LangChainModule`. It
defaults to `false`.

Like `name`, `isGlobal` belongs at the root of the `registerAsync` options, outside the factory
result, and `register` takes it the same way:

```ts
@Module({
  imports: [
    SupportModule,
    LangChainModule.registerAsync({
      name: 'SUPPORT_AGENT',
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        model: {
          model: 'openai:gpt-5-mini',
          apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
        },
      }),
    }),
  ],
})
export class AppModule {}

// SupportModule does not import LangChainModule.
@Injectable()
export class SupportService {
  constructor(@InjectAgent('SUPPORT_AGENT') private readonly support: Agent) {}
}
```

Without a `name`, the global agent is injected as `Agent`.

## Agent names

Each `register` or `registerAsync` call adds one agent. Names are case-sensitive and unique: two
agents sharing a name, or two agents without one, fail the bootstrap. `'default'` and the empty
string are reserved for the agent registered without a name.
