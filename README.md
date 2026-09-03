<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

<p align="center">
  A <a href="https://nestjs.com/">Nest</a> module wrapper for building AI agent with <a href="https://www.langchain.com/">LangChain</a>.
</p>

<p align="center">
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/pulse"><img src="https://img.shields.io/github/commit-activity/m/Martin-Bruel/nestjs-langchain" alt="GitHub commit activity"></a>
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/graphs/contributors"><img src="https://img.shields.io/github/contributors/Martin-Bruel/nestjs-langchain" alt="Contributors"></a>
</p>

<p align="center">
  <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/Martin-Bruel/nestjs-langchain">
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/Martin-Bruel/nestjs-langchain.svg"></a>
  <a href="https://github.com/Martin-Bruel/nestjs-langchain/pulls"><img alt="GitHub pull requests" src="https://img.shields.io/github/issues-pr/Martin-Bruel/nestjs-langchain"></a>
</p>
</p>

**Table of Contents**

- [Description](#description)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Defining tools](#defining-tools)
- [Multi-agent support](#multi-agent-support)
- [Async configuration](#async-configuration)
- [Contributing](#contributing)
- [License](#license)

## Description

**nestjs-langchain** is a powerful, decorator-driven wrapper that integrates LangChain agents seamlessly into the NestJS ecosystem. It allows you to transform standard NestJS services into AI tools and manage multiple isolated agents with distinct roles and configurations.

## Installation

```bash
npm install --save nestjs-langchain langchain @langchain/<ai-provider>
```

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

### 2. Usage

Once registered, simply inject the `LangChainService` to interact with your agent.

```ts
@Injectable()
export class AppService {
  constructor(private readonly agent: LangChainService) {}

  async ask(question: string) {
    return await this.agent.run(question);
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
    @ToolParam({
      name: 'a',
      description: 'The first number to add.',
      type: 'number',
    })
    a: number,
    @ToolParam({
      name: 'b',
      description: 'The second number to add.',
      type: 'number',
    })
    b: number,
  ): number {
    return a + b;
  }
}
```

### 2. Attach tool to the agent

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

> **_NOTE:_** Any module passed to the tools array of LangChainModule must also be imported into the NestJS context (usually in the same @Module decorator). This ensures that the services containing your @Tool() decorators are correctly instantiated and managed by the NestJS dependency injection system.

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

To use a specific agent in your services, use the @InjectAgent() decorator with the corresponding name:

```ts
@Injectable()
export class AppService {
  constructor(
    @InjectAgent('MATH_AGENT') private readonly mathAgent: LangChainService,
    @InjectAgent('MONGO_AGENT')
    private readonly supportAgent: LangChainService,
  ) {}

  async solveProblem(query: string) {
    return this.mathAgent.run(query);
  }
}
```

## Async Configuration

To inject configuration from a ConfigService or other providers, use registerAsync:

```ts
import { LangChainModule } from 'nestjs-langchain';
import { MathModule } from './math/math.module';
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
  ],
})
export class AppModule {}
```

> **_NOTE:_** The name property is required at the root of registerAsync because it defines the injection token used by @InjectAgent(). It cannot be determined dynamically inside the factory.

## Contributing

All types of contributions are encouraged and valued. See the Contributing guidelines, the community looks forward to your contributions!

## License

This project is released under the under terms of the MIT License.
