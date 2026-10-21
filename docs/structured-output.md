# Structured output

`run(input, { output })` returns the object a Zod schema parses, typed from it. This page details
[Structured output](../README.md#structured-output).

## How the model answers

The same agent answers in text when a run has no `output`. With one, the model answers:

- **natively**, when its LangChain profile declares `structuredOutput` (most OpenAI models): the
  provider constrains the answer to the schema
- **through a tool** otherwise (Mistral, for instance): the model calls a tool whose parameters
  are the schema. An answer that does not match is sent back to the model, at most twice

Choosing the strategy yourself is tracked in
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

## OpenAI: strict schemas

A native answer on OpenAI is strict: it always matches the schema, but OpenAI accepts only a subset
of JSON Schema, in `output` **and in the parameters of every tool of the agent**:

- every field is required: write `.nullable()` instead of `.optional()` in `output` and in a
  `@ToolParam` `schema`
- an optional `@ToolParam` is sent nullable, unless its `schema` accepts `null` itself: then it
  stays optional, and its agent cannot return a structured output on OpenAI
- no `z.record()`, `z.tuple()` or `.and()`, and an object at the root

OpenAI answers anything else with a 400 that names what it refuses. Text runs are not affected.

## Errors

- `StructuredOutputError`, a subclass of `AgentRunError`: the model gave no answer matching the
  schema, after the retries. LangChain's or Zod's error is in `cause`
- a schema the provider refuses, such as OpenAI's 400 above: an `AgentRunError`, the provider's
  error in `cause`
