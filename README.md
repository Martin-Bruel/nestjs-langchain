<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

<p align="center">
  A <a href="https://nestjs.com/">Nest</a> module wrapper for building AI agents with <a href="https://www.langchain.com/">LangChain</a>.
</p>

<p align="center">
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Martin-Bruel/nestjs-langchain/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://www.npmjs.com/package/nestjs-langchain"><img alt="npm version" src="https://img.shields.io/npm/v/nestjs-langchain"></a>
  <a href="https://www.npmjs.com/package/nestjs-langchain"><img alt="npm downloads" src="https://img.shields.io/npm/dm/nestjs-langchain"></a>
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/nestjs-langchain"></a>
</p>

<p align="center">
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/Martin-Bruel/nestjs-langchain"></a>
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/graphs/contributors"><img alt="Contributors" src="https://img.shields.io/github/contributors/Martin-Bruel/nestjs-langchain"></a>
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/issues"><img alt="Open issues" src="https://img.shields.io/github/issues/Martin-Bruel/nestjs-langchain"></a>
</p>

**Table of Contents**

- [Description](#description)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Defining tools](#defining-tools)
- [Multi-agent support](#multi-agent-support)
- [Async configuration](#async-configuration)
- [Testing](#testing)
- [Logging and observing](#logging-and-observing)
- [Contributing](#contributing)
- [License](#license)

## Description

**nestjs-langchain** is a powerful, decorator-driven wrapper that integrates LangChain agents seamlessly into the NestJS ecosystem. It allows you to transform standard NestJS services into AI tools and manage multiple isolated agents with distinct roles and configurations.

## Installation

```bash
npm install nestjs-langchain @langchain/<ai-provider>
```

Requires **NestJS 11.1.18+ or 12.0.1+**, **`langchain` 1.5.4+**, **Zod 4**, **Node 22.12+** and
**TypeScript 5.8+**.

> **_NOTE:_** Yarn does not install `langchain`, `@langchain/core` and `zod` as peer dependencies, so add them explicitly:
>
> ```bash
> yarn add nestjs-langchain @langchain/<ai-provider> langchain @langchain/core zod
> ```

Having troubles configuring `nestjs-langchain`? Clone this repository and run a sample, whose
README says what it needs:

```bash
npm install
npm run build
cd samples/chat
npm run start
```

Requirements in detail, CommonJS applications and Jest: [docs/setup.md](docs/setup.md).

## Quick start

### 1. Register an agent

```ts
import { Module } from '@nestjs/common';
import { LangChainModule } from 'nestjs-langchain';
import { AppService } from './app.service.js';

@Module({
  imports: [
    LangChainModule.register({
      // `provider:model`. Without an `apiKey`, the provider reads its own
      // environment variable, here OPENAI_API_KEY.
      model: { model: 'openai:gpt-5-mini' },
      systemPrompt: 'You are a helpful assistant.',
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
```

> **_NOTE:_** The model property allows you to select your AI engine based on the provider (OpenAI, Anthropic, Google, etc.). You can find the list of all available integrations here:  
> 👉 [LangChain Chat Integrations](https://docs.langchain.com/oss/javascript/integrations/chat/index)

> **_NOTE:_** `model` also accepts a chat model you built yourself, such as
> `new ChatOpenAI({ ... })`, for what the configuration cannot express: a proxy, an Azure
> deployment, a fake in tests.

Model options and providers: [docs/models.md](docs/models.md).

### 2. Inject the agent

Inject `Agent` and run it:

```ts
import { Injectable } from '@nestjs/common';
import { Agent } from 'nestjs-langchain';

@Injectable()
export class AppService {
  constructor(private readonly agent: Agent) {}

  async ask(question: string): Promise<string> {
    const { output } = await this.agent.run(question);
    return output;
  }
}
```

## Defining Tools

### 1. Define the tool

Turn a service method into a tool with `@Tool()`, and describe its parameters with `@ToolParam()`:

```ts
import { Injectable } from '@nestjs/common';
import { Tool, ToolParam } from 'nestjs-langchain';

@Injectable()
export class MathService {
  @Tool({ description: 'Adds two numbers.' })
  add(
    @ToolParam({ name: 'a', description: 'The first number.' }) a: number,
    @ToolParam({ name: 'b', description: 'The second number.' }) b: number,
  ): number {
    return a + b;
  }
}
```

The tool is named after the method, unless `@Tool()` takes a `name`.

### 2. Declare the parameter types

Use a Zod `schema` for any parameter that is not a `string`, `number` or `boolean`.

```ts
import { z } from 'zod';

@Tool({ description: 'Searches the catalogue.' })
search(
  @ToolParam({ name: 'query' }) query: string,
  @ToolParam({
    name: 'filter',
    description: 'Restricts the results.',
    schema: z.object({ field: z.string(), value: z.string() }),
  })
  filter: { field: string; value: string },
  @ToolParam({ name: 'limit', optional: true }) limit?: number,
): Promise<Result[]> {
  // ...
}
```

### 3. Attach tool to the agent

List the module that declares the service in `tools`, and import it:

```ts
import { Module } from '@nestjs/common';
import { LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math/math.module.js';

@Module({
  imports: [
    MathModule,
    LangChainModule.register({
      model: { model: 'openai:gpt-5-mini' },
      tools: [MathModule],
    }),
  ],
})
export class AppModule {}
```

Naming, parameter types, tool modules and the checks at bootstrap: [docs/tools.md](docs/tools.md).
Before exposing tools to users, read [docs/security.md](docs/security.md).

## Multi-Agent Support

Give each agent a `name`, and inject it with `@InjectAgent()`.

### 1. Register a specific agent

```ts
@Module({
  imports: [
    MathModule,
    MongoModule,
    LangChainModule.register({
      name: 'MATH_AGENT',
      model: { model: 'openai:gpt-5-mini' },
      tools: [MathModule],
    }),
    LangChainModule.register({
      name: 'MONGO_AGENT',
      model: { model: 'openai:gpt-5-mini' },
      tools: [MongoModule],
    }),
  ],
  providers: [AppService],
})
export class AppModule {}
```

### 2. Use a specific agent

```ts
@Injectable()
export class AppService {
  constructor(
    @InjectAgent('MATH_AGENT') private readonly math: Agent,
    @InjectAgent('MONGO_AGENT') private readonly mongo: Agent,
  ) {}
}
```

`Agent` without `@InjectAgent()` is the agent registered without a name.

## Async Configuration

Build the options from other providers with `registerAsync`:

```ts
import { ConfigModule, ConfigService } from '@nestjs/config';

LangChainModule.registerAsync({
  // Outside the factory: it names the token `@InjectAgent()` resolves.
  name: 'MATH_AGENT',
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    model: {
      model: 'openai:gpt-5-mini',
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    },
    tools: [MathModule],
  }),
});
```

`useClass` and `useExisting` take a class implementing `LangChainOptionsFactory`.

`useClass`, `name` and agent names in detail: [docs/setup.md](docs/setup.md#registerasync).

## Testing

Replace an agent with `overrideProvider`: `Agent` for the agent registered without a name,
`getAgentToken(name)` for a named one.

```ts
import { Test } from '@nestjs/testing';
import { getAgentToken } from 'nestjs-langchain';

const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(getAgentToken('MATH_AGENT'))
  .useValue({
    run: async () => ({ status: 'completed', output: '42', tools: [], durationMs: 0 }),
  })
  .compile();
```

Or run the real agent and its tools against LangChain's `fakeModel()`, which replays the answers
and tool calls you queue:

```ts
import { Test } from '@nestjs/testing';
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';
import { Agent, LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math/math.module.js';

const model = fakeModel()
  .respondWithTools([{ name: 'add', args: { a: 1, b: 2 } }])
  .respond(new AIMessage('The result is 3.'));

const moduleRef = await Test.createTestingModule({
  imports: [MathModule, LangChainModule.register({ model, tools: [MathModule] })],
}).compile();
// The agent is built on init, which `compile()` does not run.
await moduleRef.init();

const { output } = await moduleRef.get(Agent).run('1 + 2?');
```

Testing with Jest: [docs/setup.md](docs/setup.md#testing-with-jest).

## Logging and observing

Record what a run does through `observer`:

```ts
LangChainModule.register({
  model: { model: 'openai:gpt-5-mini' },
  tools: [MathModule],
  observer: {
    onToolStart: ({ tool, args }) => console.log(`${tool} called with`, args),
    onToolError: ({ tool, reason, error }) =>
      console.error(`${tool} failed (${reason})`, error),
    onRunFinish: ({ durationMs, tools, tokens }) =>
      console.log({ durationMs, tools, tokens }),
  },
});
```

With `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` set, every run is also traced in LangSmith.

Every event, the errors, the log lines and `callbacks`: [docs/observing.md](docs/observing.md).

### Errors

Everything `run()` throws is an `AgentRunError`, with the `agent` that failed and the original
error in `cause`:

```ts
import { AgentRunError } from 'nestjs-langchain';

try {
  await agent.run(question);
} catch (error) {
  if (error instanceof AgentRunError) {
    console.error(error.agent, error.message, error.cause);
  }
}
```

## Contributing

Contributions are welcome. Read the
[contributing guidelines](https://github.com/Martin-Bruel/nestjs-langchain/blob/main/CONTRIBUTING.md)
and the [code of conduct](https://github.com/Martin-Bruel/nestjs-langchain/blob/main/CODE_OF_CONDUCT.md)
first.

## License

This project is released under the terms of the MIT License.
