# Observing

What a run does reaches you through the `observer` option, the log lines, and LangChain's own
callbacks. This page details [Logging and observing](../README.md#logging-and-observing).

## The observer

Every method is optional and may be async. It is never awaited, and a throw or a rejection is
logged and swallowed, never propagated into the run.

| Method | Called | Event |
|---|---|---|
| `onToolStart` | before a tool runs, its arguments validated | `{ agent, tool, callId, args }` |
| `onToolEnd` | after a tool returns | `{ agent, tool, callId, output, durationMs }` |
| `onToolError` | after a tool call fails | `{ agent, tool, callId, reason, error, durationMs }` |
| `onModelError` | after a model call fails, which the run may still retry | `{ agent, error }` |
| `onRunFinish` | after a run returns | `{ agent, durationMs, tools, tokens }` |
| `onRunError` | after a run throws | `{ agent, durationMs, error }` |

- `agent` is the agent's `name`, `'default'` for the agent registered without one.
- `callId` is the id the model gave the call: it pairs a start with its end or error.
- `args` are parsed against the tool's schema; `output` is what the method returned.
- `reason` is `'threw'` (the method threw), `'invalid-arguments'` (the schema rejected what the
  model wrote) or `'unknown-tool'` (the agent has no such tool). Only `'threw'` follows an
  `onToolStart`. It may gain values in a minor release: keep a `default` branch when switching on
  it.
- `tools` lists every call the model made, failed and unknown ones included.
- `tokens` is `{ input, output, total }`, summed over the run's model calls, and absent when the
  provider reports no usage.
- `onRunError`'s `error` is the one the caller of `run()` receives.

`run()` returns the same summary: `{ status, output, durationMs, tools, tokens }`.

## Errors

Everything `run()` throws is an `AgentRunError`, with the `agent` that failed and, when the
failure came from elsewhere (the provider, LangChain), the original error in `cause`. Later
releases may throw subclasses of it for new kinds of failure: a check on `AgentRunError` keeps
catching them.

A failed tool call does not fail the run: the model receives the error and carries on (see
[Tools](tools.md#what-the-model-receives)).

## Logs

The library logs through Nest's `Logger`, under the context `LangChainAgent`, each line starting
with the agent's name when it has one:

- `MATH ready with 2 tools`, once an agent is built
- at the `error` level: a failed tool call, a failed model call, an observer that threw

## LangChain callbacks and LangSmith

`callbacks` takes LangChain-native handlers, called for the same run:

```ts
LangChainModule.register({
  model: { model: 'openai:gpt-5-mini' },
  callbacks: [{ handleLLMEnd: (output) => console.log(output.llmOutput) }],
});
```

With `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` set, every run is traced in LangSmith, with
no code of yours.
