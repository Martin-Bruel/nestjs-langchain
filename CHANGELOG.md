# Changelog

## [2.0.0](https://github.com/Martin-Bruel/nestjs-langchain/compare/v1.0.2...v2.0.0) (2026-10-12)

To upgrade, install the new peers with the library, then go through the breaking changes:

```bash
npm install nestjs-langchain@2 langchain@^1.5.4 @langchain/core@^1.2.3 zod@^4
```

### ⚠ BREAKING CHANGES

#### Package and requirements

* The package is ESM only, with an `exports` map. A CommonJS application loads it through Node's
  `require(esm)`: Node 22.12 or later, and TypeScript 5.8 or later with `module` set to `nodenext`.
  Imports into `dist/` no longer resolve. With Jest, run Node 24.9 or later. ([#78](https://github.com/Martin-Bruel/nestjs-langchain/issues/78))
* Node 22.12 or later is required. ([#78](https://github.com/Martin-Bruel/nestjs-langchain/issues/78))
* The peer dependencies change: `@nestjs/common` and `@nestjs/core` `^11.1.18 || ^12.0.1`, raised
  from `^11.1.12`, which carried published advisories; `langchain` `^1.5.4`, raised from `^1.2.15`;
  `@langchain/core` `^1.2.3`, now required; `zod` `^4.0.0`, now a peer rather than a dependency. ([#55](https://github.com/Martin-Bruel/nestjs-langchain/issues/55), [#75](https://github.com/Martin-Bruel/nestjs-langchain/issues/75), [#88](https://github.com/Martin-Bruel/nestjs-langchain/issues/88), [#205](https://github.com/Martin-Bruel/nestjs-langchain/issues/205))
* `TOOL_METADATA`, `TOOL_PARAMS_METADATA` and `TOOL_PARAM_METADATA` are no longer exported. ([#82](https://github.com/Martin-Bruel/nestjs-langchain/issues/82))

#### API

* `LangChainService` is now `Agent`. The `Agent` class token reaches the agent registered without a
  name only: inject a named agent with `@InjectAgent(name)`, and fetch or override it with
  `getAgentToken(name)`. ([#159](https://github.com/Martin-Bruel/nestjs-langchain/issues/159), [#172](https://github.com/Martin-Bruel/nestjs-langchain/issues/172))
* `run()` resolves to a `CompletedRun` instead of a string: read its `output`,
  `const { output } = await agent.run(question)`. ([#164](https://github.com/Martin-Bruel/nestjs-langchain/issues/164))
* Everything `run()` throws is an `AgentRunError`, with the agent's name in `agent` and the
  provider's error in `cause`: match on `error.cause` where the provider's error was caught.
  ([#163](https://github.com/Martin-Bruel/nestjs-langchain/issues/163))
* Agent names are case-sensitive: `@InjectAgent('math')` no longer finds an agent registered as
  `'MATH'`. Use `getAgentToken(name)` rather than the `'LANGCHAIN_AGENT_<NAME>'` string.
  ([#162](https://github.com/Martin-Bruel/nestjs-langchain/issues/162))
* `@ToolParam()` no longer takes a `type`: a `string`, `number` or `boolean` parameter is read from
  the signature, anything else takes a Zod `schema`. ([#87](https://github.com/Martin-Bruel/nestjs-langchain/issues/87), [#88](https://github.com/Martin-Bruel/nestjs-langchain/issues/88))
* An options class given to `registerAsync` as `useClass` or `useExisting` implements
  `LangChainOptionsFactory`, whose method is `createLangChainOptions` instead of `create`. A
  `useFactory` returning a key the options do not declare no longer compiles. ([#108](https://github.com/Martin-Bruel/nestjs-langchain/issues/108), [#208](https://github.com/Martin-Bruel/nestjs-langchain/issues/208))
* `@Tool()` on a class no longer compiles: put it on the method to expose. ([#168](https://github.com/Martin-Bruel/nestjs-langchain/issues/168))

#### Checks at bootstrap

A configuration that booted with missing, ambiguous or broken tools now stops the application,
with every problem listed in one error:

* in `tools`: an entry that is not a module, a module that is not imported or declares no `@Tool()`
  method, or a module class Nest holds several instances of ([#97](https://github.com/Martin-Bruel/nestjs-langchain/issues/97), [#210](https://github.com/Martin-Bruel/nestjs-langchain/issues/210), [#240](https://github.com/Martin-Bruel/nestjs-langchain/issues/240))
* two tools of one agent sharing a name, a name outside `/^[a-zA-Z0-9_-]{1,64}$/`, or a name
  starting with `extract-`, which LangChain reserves ([#90](https://github.com/Martin-Bruel/nestjs-langchain/issues/90), [#97](https://github.com/Martin-Bruel/nestjs-langchain/issues/97), [#215](https://github.com/Martin-Bruel/nestjs-langchain/issues/215))
* a parameter schema that contradicts the signature, or has no JSON Schema form, such as `z.date()`:
  convert it, for instance `z.iso.datetime().transform((value) => new Date(value))` ([#88](https://github.com/Martin-Bruel/nestjs-langchain/issues/88), [#209](https://github.com/Martin-Bruel/nestjs-langchain/issues/209))
* two `@ToolParam()` sharing a name, or a `@ToolParam()` on a method without `@Tool()` ([#167](https://github.com/Martin-Bruel/nestjs-langchain/issues/167), [#168](https://github.com/Martin-Bruel/nestjs-langchain/issues/168))
* a `@Tool()` on a request-scoped or transient provider, or on one depending on a request-scoped
  provider ([#173](https://github.com/Martin-Bruel/nestjs-langchain/issues/173))
* two agents sharing a name, two agents without one, or the names `'default'` and `''` ([#162](https://github.com/Martin-Bruel/nestjs-langchain/issues/162))

### Features

* NestJS 12 is supported, next to NestJS 11. ([#78](https://github.com/Martin-Bruel/nestjs-langchain/issues/78))
* `model` accepts a chat model you built, such as `new ChatOpenAI({ ... })`, from an ESM or a
  CommonJS application, and `apiKey` is optional: without it, the provider reads its own
  environment variable. ([#53](https://github.com/Martin-Bruel/nestjs-langchain/issues/53), [#171](https://github.com/Martin-Bruel/nestjs-langchain/issues/171))
* `@Tool()` takes a `name`, the method's name by default. ([#90](https://github.com/Martin-Bruel/nestjs-langchain/issues/90))
* `@ToolParam()` reads `string`, `number` and `boolean` from the signature, takes a Zod `schema` for
  any other type, and an `optional` flag; its `description` is optional. ([#87](https://github.com/Martin-Bruel/nestjs-langchain/issues/87))
* `tools` accepts what Nest's `imports` accepts: a dynamic module such as `forRoot()`, a promise of
  one, or a `forwardRef()`. ([#98](https://github.com/Martin-Bruel/nestjs-langchain/issues/98))
* `observer` receives each run's events: a tool's start, end or failure and why it failed, a model
  failure, and the run's end or failure. ([#101](https://github.com/Martin-Bruel/nestjs-langchain/issues/101), [#163](https://github.com/Martin-Bruel/nestjs-langchain/issues/163), [#214](https://github.com/Martin-Bruel/nestjs-langchain/issues/214))
* `callbacks` takes LangChain-native handlers, called for each run. ([#101](https://github.com/Martin-Bruel/nestjs-langchain/issues/101))
* `run()` reports the tools the model called, the tokens the run used and its duration. ([#164](https://github.com/Martin-Bruel/nestjs-langchain/issues/164))
* `AgentRunError` and `ToolConfigurationError` are exported, and the errors at bootstrap name the
  agent that failed. ([#163](https://github.com/Martin-Bruel/nestjs-langchain/issues/163), [#241](https://github.com/Martin-Bruel/nestjs-langchain/issues/241))
* `getAgentToken(name)` is exported, for `overrideProvider()` in tests and for factories'
  `inject`. ([#161](https://github.com/Martin-Bruel/nestjs-langchain/issues/161))
* The options, the observer's events and `CompletedRun` are exported as types. ([#82](https://github.com/Martin-Bruel/nestjs-langchain/issues/82))
* The package ships its sources with source and declaration maps: "Go to definition" opens the
  TypeScript source. ([#219](https://github.com/Martin-Bruel/nestjs-langchain/issues/219))

### Bug Fixes

* `run()` returns the answer even when the provider sets no `finish_reason`. ([#67](https://github.com/Martin-Bruel/nestjs-langchain/issues/67))
* Tool modules are matched by class, not by class name: two modules sharing a name stay apart, and
  a minified build keeps its tools. ([#58](https://github.com/Martin-Bruel/nestjs-langchain/issues/58))
* `@langchain/core` is declared as a peer dependency, which pnpm and Yarn PnP need. ([#55](https://github.com/Martin-Bruel/nestjs-langchain/issues/55))
* A CommonJS application no longer meets two incompatible declarations of LangChain's types.
  ([#64](https://github.com/Martin-Bruel/nestjs-langchain/issues/64), [#171](https://github.com/Martin-Bruel/nestjs-langchain/issues/171))
* An integer schema such as `z.int()` is accepted on a `number` parameter. ([#165](https://github.com/Martin-Bruel/nestjs-langchain/issues/165))
* A union schema on a `string`, `number` or `boolean` parameter is checked the same way on every
  Zod 4 release. ([#207](https://github.com/Martin-Bruel/nestjs-langchain/issues/207))
* A failed tool call no longer sends a stack trace, with the server's paths, to the model. ([#180](https://github.com/Martin-Bruel/nestjs-langchain/issues/180))
* Arguments the schema rejects and calls to unknown tools are reported to the observer and the
  logs. ([#181](https://github.com/Martin-Bruel/nestjs-langchain/issues/181), [#214](https://github.com/Martin-Bruel/nestjs-langchain/issues/214))
* A subclass can override or redecorate a `@Tool()` method. ([#212](https://github.com/Martin-Bruel/nestjs-langchain/issues/212))
* An error is written to the logs in linear time: a long run of whitespace in its message could
  stall the application. ([#206](https://github.com/Martin-Bruel/nestjs-langchain/issues/206))
* A `model` that is neither a chat model nor a configuration gets a clear message, and a model that
  cannot be built names its agent. ([#241](https://github.com/Martin-Bruel/nestjs-langchain/issues/241))

## 1.0.2 and earlier

See the [v1.0.2 release](https://github.com/Martin-Bruel/nestjs-langchain/releases/tag/v1.0.2).
