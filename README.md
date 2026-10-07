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
npm install --save nestjs-langchain @langchain/<ai-provider>
```

Requires **NestJS 11.1.18 or 12**, **`langchain` 1.5.4 or later**, **Node 22.12 or later**, and
**TypeScript 5.8 or later**.

> **_NOTE:_** Yarn does not install `langchain`, `@langchain/core` and `zod` as peer dependencies, so add them explicitly:
>
> ```bash
> yarn add nestjs-langchain @langchain/<ai-provider> langchain @langchain/core zod
> ```

Having troubles configuring `nestjs-langchain`? Clone this repository and `cd` in a sample:

```bash
cd samples/chat
npm install
npm run start
```

## Quick start

### 1. Register the module

You can register the `LangChainModule` in your `AppModule` or any specific feature module.

```ts
import { LangChainModule } from 'nestjs-langchain';

@Module({
  imports: [
    LangChainModule.register({
      model: {
        model: 'your-model-name', // Syntax: provider:model-name
        apiKey: 'your-api-key',
      },
      systemPrompt: 'your-system-prompt',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

> **_NOTE:_** The model property allows you to select your AI engine based on the provider (OpenAI, Anthropic, Google, etc.). You can find the list of all available integrations here:  
> 👉 [LangChain Chat Integrations](https://docs.langchain.com/oss/javascript/integrations/chat/index)

> **_NOTE:_** `apiKey` is optional. Most providers read their own environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, …) when it is omitted, and Bedrock, Vertex AI and Ollama do not use one at all.

#### Bringing your own model

`model` also accepts a chat model you have already built. Use this when you need
something the configuration object does not carry — a custom `baseUrl`, a proxy, an
Azure deployment, a provider LangChain cannot resolve from a `provider:name` string —
or when you want a deterministic fake in your tests.

```ts
import { ChatOpenAI } from '@langchain/openai';

LangChainModule.register({
  model: new ChatOpenAI({
    model: 'gpt-5-mini',
    configuration: { baseURL: 'https://my-proxy.internal/v1' },
  }),
  systemPrompt: 'your-system-prompt',
});
```

The instance is used as-is: no resolution happens, so nothing you configured on it is
overridden. In tests, the same door lets you boot the module with no key and no network:

```ts
import { FakeListChatModel } from '@langchain/core/utils/testing';

LangChainModule.register({
  model: new FakeListChatModel({ responses: ['42'] }),
});
```

### 2. Usage

Once registered, inject `Agent` to run your agent.

```ts
@Injectable()
export class AppService {
  constructor(private readonly agent: Agent) {}

  async ask(question: string) {
    const { output } = await this.agent.run(question);
    return output;
  }
}
```

## Defining Tools

Tools allow your AI agents to interact with the real world, fetch live data, and perform complex tasks, significantly enriching their responses beyond their static training data.

### 1. Define the tool

You can easily turn any NestJS service method into an AI tool using the @Tool() decorator.

```ts
import { Tool, ToolParam } from 'nestjs-langchain';

@Injectable()
export class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({ name: 'a', description: 'The first number to add.' })
    a: number,
    @ToolParam({ name: 'b', description: 'The second number to add.' })
    b: number,
  ): number {
    return a + b;
  }
}
```

`@Tool` also takes a `name`, defaulting to the method name:

```ts
@Tool({ name: 'add_numbers', description: 'Adds two numbers together.' })
addTwoNumbersTogether(/* ... */) {}
```

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

> **_NOTE:_** Reflection only sees the erased type. A union of string literals such as
> `'+' | '-'` erases to `String`, so pass `schema: z.enum(['+', '-'])` to narrow it. A
> `number | undefined` erases to `Object` and is rejected: declare `limit?: number` instead.

### 3. Attach tool to the agent

To make tools available to your agent, simply add the corresponding module to the tools array option of the LangChainModule during the registration.

```ts
import { LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math/math.module';

@Module({
  imports: [
    LangChainModule.register({
      model: {
        model: 'your-model-name', // Syntax: provider:model-name
        apiKey: 'your-api-key',
      },
      systemPrompt: 'your-system-prompt',
      tools: [MathModule],
    }),
    MathModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

> **_NOTE:_** Any module passed to `tools` must also be imported into the Nest context, usually in
> the same `@Module` decorator, so the services carrying your `@Tool()` methods are instantiated.
> Tools are read from the providers a module declares, not from the modules it imports: list the
> module that declares them. This is checked at bootstrap: an entry that is not a module, a module
> that was never imported or declares no tool, and two tools sharing a name each stop the
> application from starting, and every problem found is reported at once.

### A tool module that needs configuration

`tools` accepts whatever Nest's own `imports` accepts: a module class, a dynamic module, a
promise of one, or a `forwardRef`. A tool provider configured through `forRoot()` works as is:

```ts
const weather = WeatherModule.forRoot({ apiKey: process.env.WEATHER_KEY });

@Module({
  imports: [
    weather,
    LangChainModule.register({
      model: { model: 'your-model-name' },
      systemPrompt: 'your-system-prompt',
      tools: [weather],
    }),
  ],
})
export class AppModule {}
```

## Multi-Agent Support

If you need multiple agents with different roles in the same application, you can register them with unique names. Each agent is a distinct instance with its own configuration, system prompt, and specific set of tools. This isolation prevents "tool confusion" where an agent might try to use irrelevant tools for a given task, improving accuracy and reducing token costs.

For example, you can have a "Support Agent" with access to your database and a "Math Agent" with access to calculation tools.

### 1. Register a specific agent

To register a specific agent you must define a name:

```ts
import { LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math/math.module';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [
    LangChainModule.register({
      name: 'MATH_AGENT',
      model: {
        model: 'your-model-name', // Syntax: provider:model-name
        apiKey: 'your-api-key',
      },
      systemPrompt: 'your-system-prompt',
      tools: [MathModule],
    }),
    LangChainModule.register({
      name: 'MONGO_AGENT',
      model: {
        model: 'your-model-name', // Syntax: provider:model-name
        apiKey: 'your-api-key',
      },
      systemPrompt: 'your-system-prompt',
      tools: [MongoModule],
    }),
    MathModule,
    MongoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### 2. Use a specific agent

To use a specific agent in your services, use the @InjectAgent() decorator with the corresponding name.
Injecting `Agent` without it resolves to the unnamed agent only, and fails when none is registered:

```ts
@Injectable()
export class AppService {
  constructor(
    @InjectAgent('MATH_AGENT') private readonly mathAgent: Agent,
    @InjectAgent('MONGO_AGENT')
    private readonly mongoAgent: Agent,
  ) {}

  async solveProblem(query: string) {
    const { output } = await this.mathAgent.run(query);
    return output;
  }
}
```

## Async Configuration

To inject configuration from a ConfigService or other providers, use registerAsync:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LangChainModule } from 'nestjs-langchain';
import { MongoModule } from './mongo/mongo.module';

@Module({
  imports: [
    LangChainModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        model: {
          model: 'openai:gpt-5-mini',
          apiKey: configService.get<string>('OPENAI_API_KEY'),
        },
        systemPrompt: 'your-system-prompt',
        tools: [MongoModule],
      }),
      inject: [ConfigService],
      name: 'MONGO',
    }),
    MongoModule,
  ],
})
export class AppModule {}
```

> **_NOTE:_** The `name` property is optional. When provided, set it at the root of `registerAsync` because it defines the injection token used by `@InjectAgent()`. It cannot be determined dynamically inside the factory.

## Testing

Replace an agent with a mock through `overrideProvider`: the `Agent` class for the unnamed agent,
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

To run the real agent and its tools without a provider, pass LangChain's `fakeModel()` as `model`:
it replays the answers and tool calls you queue, and records what it received.

```ts
import { AIMessage } from '@langchain/core/messages';
import { fakeModel } from '@langchain/core/testing';

const model = fakeModel()
  .respondWithTools([{ name: 'add', args: { a: 1, b: 2 } }])
  .respond(new AIMessage('The result is 3.'));

LangChainModule.register({ model, tools: [MathModule] });
```

## Logging and observing

Capture what you want to record through `observer`:

```ts
LangChainModule.register({
  model: { model: 'openai:gpt-5-mini' },
  tools: [MongoModule],
  observer: {
    onToolStart: ({ tool, callId, args }) => {
      console.log(`Tool start: ${tool} (${callId})`, args);
    },
    onToolEnd: ({ tool, callId, output, durationMs }) => {
      console.log(`Tool end: ${tool} (${callId}) in ${durationMs}ms`, output);
    },
    onToolError: ({ tool, error }) => {
      console.error(`Tool error: ${tool}`, error);
    },
    onRunFinish: (summary) => {
      console.log('Run summary:', summary);
    },
    onRunError: ({ agent, error }) => {
      console.error(`Run of ${agent} failed:`, error.cause);
    },
  },
});
```

| Method | Event |
|---|---|
| `onToolStart` | `{ agent, tool, callId, args }`, the arguments parsed against the tool's schema |
| `onToolEnd` | `{ agent, tool, callId, output, durationMs }`, `output` being what the method returned |
| `onToolError` | `{ agent, tool, callId, error, durationMs }`, also for arguments the schema rejects (`durationMs: 0`) |
| `onModelError` | `{ agent, error }` |
| `onRunFinish` | `{ agent, durationMs, tools, tokens }`, for a run that returns |
| `onRunError` | `{ agent, durationMs, error }`, for a run that throws, with the error the caller receives |


### Errors

Everything `run()` throws is an `AgentRunError`, carrying the `agent` that failed and, when the
failure came from elsewhere (the provider, a tool loop), the original error in `cause`:

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

Later releases may throw subclasses of `AgentRunError` for new kinds of failure: a check on
`AgentRunError` keeps catching them.

`callbacks` takes LangChain-native handlers for the same run, and `LANGSMITH_TRACING=true` sends
the whole run to LangSmith with no code here.

## Contributing

All types of contributions are encouraged and valued. Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

This project is released under the terms of the MIT License.
