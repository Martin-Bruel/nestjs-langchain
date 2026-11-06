import type { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import {
  type CallbackManager,
  ensureHandler,
} from '@langchain/core/callbacks/manager';
import type { AgentCallback } from '../interfaces/langchain-module-options.interface.js';
import { CallerRun } from './caller-run.js';

// Each run's model error handler: the agents it runs report their own.
const modelErrorHandlers = new WeakSet<object>();

// One handler per callback: a callback shared by an agent and the agent it
// runs would otherwise be added twice, and older `@langchain/core` versions
// do not deduplicate handlers. See #323.
const handlers = new WeakMap<object, BaseCallbackHandler>();

const handlerOf = (callback: AgentCallback): BaseCallbackHandler => {
  const cached = handlers.get(callback);

  if (cached) {
    return cached;
  }

  const handler = ensureHandler(callback);

  handlers.set(callback, handler);
  return handler;
};

// Recognised by its methods: two copies of `@langchain/core` break
// `instanceof`. See #52.
const isManager = (value: unknown): value is CallbackManager =>
  typeof value === 'object' &&
  value !== null &&
  'copy' in value &&
  typeof value.copy === 'function' &&
  'removeHandler' in value;

/**
 * Marks a run's model error handler, which no agent the run calls takes.
 *
 * @internal
 * @param handler The handler.
 * @returns The same handler.
 */
export const asModelErrorHandler = (
  handler: BaseCallbackHandler,
): BaseCallbackHandler => {
  modelErrorHandlers.add(handler);
  return handler;
};

/**
 * The callbacks a run hands to `invoke`. Inside another run, the caller's
 * manager with these added: the run nests in the caller's trace and the
 * caller's callbacks see it, as LangChain does for any subagent, while each
 * agent keeps its model errors to itself. See #323.
 *
 * @internal
 * @param own The run's model error handler and its agent's `callbacks`.
 * @returns The callbacks for `invoke`.
 */
export const runCallbacks = (
  own: AgentCallback[],
): AgentCallback[] | CallbackManager => {
  const ownHandlers = own.map(handlerOf);
  const { callbacks } = CallerRun.current();

  if (!isManager(callbacks)) {
    return ownHandlers;
  }

  const nested = callbacks.copy();

  nested.handlers
    .filter((handler) => modelErrorHandlers.has(handler))
    .forEach((handler) => nested.removeHandler(handler));

  for (const handler of ownHandlers) {
    if (!nested.handlers.includes(handler)) {
      nested.addHandler(handler, true);
    }
  }

  return nested;
};
