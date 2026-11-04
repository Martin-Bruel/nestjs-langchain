# Security and limitations

## Tools are an attack surface

A `@Tool()` method is code the model decides to call, with arguments it writes from input the end
user controls. Treat a tool like a public endpoint:

- **Keep tools narrow.** They run with the application's privileges: expose read-only operations
  where you can, and a specific action rather than a generic one (`findOrder(id)`, not
  `runQuery(sql)`).
- **The schema is the validation boundary.** Bound numbers and strings, enumerate what you can, and
  reject the unknown keys of an object parameter with `z.strictObject()`.
- **An agent only gets the tools its callers may use.** Split agents by audience rather than check
  permissions inside one: a public chatbot and a back-office agent are two agents, each with its
  own `tools`.
- **What a tool throws reaches the model,** and so its provider: the model receives the error's
  message to correct itself. Throw messages meant for the model, without connection strings, host
  names or personal data.
- **Never pass secrets through tool arguments**, and mind that the `observer` events carry
  arguments and outputs, so user data.
- **An action that cannot be undone** should wait for a human's approval, which is not built in yet
  ([#153](https://github.com/Martin-Bruel/nestjs-langchain/issues/153)): keep such actions out of
  tools, or have the tool record a request that a human confirms elsewhere.

## The caller's identity

Never let the model write who it acts for: a `userId` argument lets a prompt injection read
another user's data. Pass it in the run's `context` instead, which only the tools receive, through
a `@ToolContext()` parameter:

```ts
// Where the agent runs, for instance in a controller:
await this.agent.run(question, { context: { userId: user.id } });

// In the tool:
@Tool({ description: 'Lists the orders of the current user.' })
listOrders(@ToolContext() { context }: ToolCallContext<{ userId: string }>): Promise<Order[]> {
  return this.orders.findByUser(context.userId);
}
```

A run without context hands the tool `undefined`, which a query such as
`find({ userId: undefined })` takes as no filter at all: give the agent a `contextSchema` to make
every run carry one. Details in [Tools](tools.md#the-runs-context).

## Limitations of 2.0.0

- One `run()` is one user message, with no conversation history
  ([#149](https://github.com/Martin-Bruel/nestjs-langchain/issues/149)).
- No streaming: `run()` returns once the agent is done
  ([#154](https://github.com/Martin-Bruel/nestjs-langchain/issues/154)).
- No structured output: the answer is text
  ([#151](https://github.com/Martin-Bruel/nestjs-langchain/issues/151)).
- No cancellation, and a run stops at LangGraph's default of 25 steps
  ([#194](https://github.com/Martin-Bruel/nestjs-langchain/issues/194)).
- No tool on a request-scoped or transient provider
  ([#127](https://github.com/Martin-Bruel/nestjs-langchain/issues/127)): pass the caller as above.
- Tools are `@Tool()` methods only, not LangChain tools such as an MCP server's, and an agent
  cannot pick one instance of a tool module among several
  ([#195](https://github.com/Martin-Bruel/nestjs-langchain/issues/195)).
