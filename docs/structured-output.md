# Structured output

`run(input, { output })` returns the object a Zod schema parses, typed from it. This page details
[Structured output](../README.md#structured-output).

## How the model answers

The same agent answers in text when a run has no `output`. With one, on every provider, the model
answers through a tool whose parameters are the schema. An answer that does not match its JSON
Schema is sent back to the model, at most twice; one that a `.refine()` or a `.transform()` then
rejects fails the run, without retry.

The model must call a tool at each turn, the agent's or this one: it may answer without calling the
agent's tools, so ask for them in the prompt when they matter.

The provider's native structured output is not used; opting into it is tracked in
[#265](https://github.com/Martin-Bruel/nestjs-langchain/issues/265).

## What the schema can do

The model receives the JSON Schema of `output`, then the schema parses its answer: `.transform()`
and `.refine()` apply, and the type of `output` is what the schema parses to.

```ts
const Invoice = z.object({
  dueDate: z.iso.date().transform((date) => new Date(date)), // a Date
  amount: z.number().transform((euros) => Math.round(euros * 100)), // in cents
});
```

A schema with no JSON Schema form, such as `z.coerce.date()`, is rejected before any model call:
declare what the model writes, and convert it with `.transform()`.

The schema's `title` is not sent to the model, which receives the tool under a name of the
library's: tell the model what the output is with `.describe()`.

On Gemini, `google-genai:` (`@langchain/google-genai`) sends a `.nullable()` field in a form Gemini
refuses, in `output` as in a `@ToolParam` `schema`
([#204](https://github.com/Martin-Bruel/nestjs-langchain/issues/204)); `google:`
(`@langchain/google`) sends the form it takes.

## Errors

- `StructuredOutputError`, a subclass of `AgentRunError`: the model gave no answer matching the
  JSON Schema after the retries, or the schema rejected the answer. LangChain's or Zod's error is
  in `cause`
- a schema the provider refuses: an `AgentRunError`, the provider's error in `cause`
