# Tools

A tool is a method of a Nest provider that the model may call. This page details
[Defining Tools](../README.md#defining-tools).

## Naming

`@Tool()` names the tool after the method, unless it takes a `name`:

```ts
@Tool({ name: 'add_numbers', description: 'Adds two numbers.' })
addTwoNumbers(
  @ToolParam({ name: 'a' }) a: number,
  @ToolParam({ name: 'b' }) b: number,
): number {
  return a + b;
}
```

A name matches `/^[a-zA-Z0-9_-]{1,64}$/`, the strictest limit a provider publishes (OpenAI's), and
does not start with `extract-`, which LangChain reserves for structured output. Two tools of one
agent cannot share a name; two agents can each have their own `search`.

## Parameters

Each argument the model fills in is a parameter decorated with `@ToolParam()`:

| Option | |
|---|---|
| `name` | The argument's name in the schema the model fills in |
| `description` | What the argument means, read by the model |
| `schema` | A Zod schema, required unless the parameter is a `string`, a `number` or a `boolean` |
| `optional` | Lets the model leave the argument out; declare the parameter `x?: T` |

An argument the model leaves out takes the parameter's default value, if it has one. A parameter
without `@ToolParam()` receives `undefined`.

### Erased types

The type of a parameter comes from TypeScript's metadata, which only keeps the erased type:

- a union of string literals such as `'+' | '-'` erases to `String`: pass
  `schema: z.enum(['+', '-'])` to narrow it
- `number | undefined` erases to `Object` and is rejected: declare `limit?: number` with
  `optional: true`
- a schema contradicting a `string`, `number` or `boolean` signature is rejected

### Dates and other values JSON Schema cannot express

Providers receive the schema as JSON Schema, so a schema with no JSON Schema form, such as
`z.date()`, `z.bigint()` or `z.map()`, is rejected. Declare what JSON Schema can express and
convert it: the model sends a string, the method receives a `Date`.

```ts
@Tool({ description: 'Books a slot.' })
book(
  @ToolParam({
    name: 'when',
    schema: z.iso.datetime().transform((value) => new Date(value)),
  })
  when: Date,
): string {
  return `Booked for ${when.toISOString()}.`;
}
```

## What the model receives

The method's return value goes back to the model as text:

| The method returns | The model receives |
|---|---|
| a string | the string |
| `undefined` (a `void` method) | an empty string |
| a number or a bigint | its digits |
| an object | its JSON, a `Date` as its ISO string |

A method that throws does not fail the run: the model receives the error's message, and may
correct itself. So do arguments the schema rejects and a call to a tool the agent does not have.
Mind what that message holds: see [Security](security.md#tools-are-an-attack-surface).

## Tool modules

`tools` lists modules: an agent gets the tools of the providers each one declares, not those of
the modules it imports. Each must also be imported into the Nest context.

`tools` accepts what Nest's `imports` accepts: a module class, a dynamic module, a promise of one,
or a `forwardRef`. A tool module configured through `forRoot()` works as is:

```ts
const weather = WeatherModule.forRoot({ unit: 'celsius' });

@Module({
  imports: [
    weather,
    LangChainModule.register({
      model: { model: 'openai:gpt-5-mini' },
      tools: [weather],
    }),
  ],
})
export class AppModule {}
```

`tools` designates module classes: a dynamic module stands for its class, and its configuration
is not compared with the imported one, so list the class or the object given to `imports`. A
class Nest holds several instances of is rejected, whether `forRoot()` was imported twice or
alongside the class itself: import it once, or give each configuration its own module class.

A tool provider is a singleton, like the agent: a request-scoped or transient provider, or one
depending on a request-scoped provider, is rejected. To tell a tool who it runs for, see
[the caller's identity](security.md#the-callers-identity).

A subclass can override a tool method: redecorate the override with `@Tool()` to keep it a tool,
since an override without decorators is not one.

## Checks at bootstrap

The application does not start while a tool is misconfigured, and the error lists every problem
at once:

- an entry of `tools` that is not a module, a module that is not imported, imported several
  times, or declaring no `@Tool()` method
- a tool name that is invalid, starts with `extract-` or is taken by another tool of the agent
- a parameter whose schema is missing, contradicts its signature or has no JSON Schema form, and
  two parameters sharing a name
- a `@ToolParam()` on a method without `@Tool()`
- a tool on a provider that is not a singleton
