import { MiddlewareError } from 'langchain';
import z from 'zod';
import { AgentContextError } from './agent-context.error.js';
import { AgentAbortedError } from './agent-aborted.error.js';
import { AgentRecursionLimitError } from './agent-recursion-limit.error.js';
import { AgentRunError } from './agent-run.error.js';
import { StructuredOutputError } from './structured-output.error.js';
import { toRunError } from './run-error.util.js';

const run = {
  agent: 'MATH',
  prefix: 'MATH ',
  recursionLimit: 25,
  validatesContext: false,
  hasContext: false,
};

// What LangChain throws for a context its `contextSchema` rejects.
const contextRejected = () =>
  z.object({ userId: z.string() }).safeParse({ userId: 42 }).error!;

const recursion = () =>
  Object.assign(new Error('Recursion limit of 4 reached.'), {
    name: 'GraphRecursionError',
  });

describe('toRunError', () => {
  it('keeps an AgentRunError as it is', () => {
    const error = new StructuredOutputError('No match.', 'MATH');

    expect(toRunError(MiddlewareError.wrap(error, 'outer'), run)).toBe(error);
  });

  it("takes an aborted run for an abort, the signal's reason in cause", () => {
    const signal = AbortSignal.abort('client left');

    const error = toRunError(new Error('anything'), { ...run, signal });

    expect(error).toBeInstanceOf(AgentAbortedError);
    expect(error).toMatchObject({
      message: "The MATH agent's run was aborted.",
      agent: 'MATH',
      cause: 'client left',
    });
  });

  it("recognises LangGraph's recursion error by its name", () => {
    const cause = recursion();

    const error = toRunError(cause, { ...run, recursionLimit: 4 });

    expect(error).toBeInstanceOf(AgentRecursionLimitError);
    expect(error).toMatchObject({ cause });
    expect(error.message).toContain('recursion limit of 4 steps');
  });

  it('wraps any other error, unwrapped from its middlewares', () => {
    const cause = new Error('rate limited');

    const error = toRunError(MiddlewareError.wrap(cause, 'outer'), {
      ...run,
      signal: new AbortController().signal,
    });

    expect(error.constructor).toBe(AgentRunError);
    expect(error).toMatchObject({
      message: "The MATH agent's run failed: rate limited",
      cause,
    });
  });

  // #321
  it("takes a ZodError for the agent's contextSchema rejecting the context", () => {
    const cause = contextRejected();

    const error = toRunError(cause, {
      ...run,
      validatesContext: true,
      hasContext: true,
    });

    expect(error).toBeInstanceOf(AgentContextError);
    expect(error).toMatchObject({
      message:
        "The MATH agent's run context does not match its `contextSchema`: " +
        '✖ Invalid input: expected string, received number → at userId',
      cause,
    });
  });

  it('says the context is missing when the run had none', () => {
    const error = toRunError(contextRejected(), {
      ...run,
      validatesContext: true,
    });

    expect(error.message).toBe(
      "The MATH agent's run has no context, which its `contextSchema` requires.",
    );
  });

  it('leaves a ZodError alone on an agent without contextSchema', () => {
    expect(toRunError(contextRejected(), run).constructor).toBe(AgentRunError);
  });
});
