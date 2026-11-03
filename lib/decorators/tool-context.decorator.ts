import { TOOL_CONTEXT_METADATA } from '../constants.js';
import { toolContextOutsideMethod } from '../errors/messages.js';

/**
 * Injects the run's `context` into a parameter of a `@Tool()` method. The
 * model never sees it: it is not one of the tool's arguments. A run of an
 * agent with such a tool must pass a `context`.
 *
 * @returns The parameter decorator.
 * @example
 * ```ts
 * \@Tool({ description: 'Lists the orders of the current user.' })
 * listOrders(@ToolContext() ctx: { userId: string }): Promise<Order[]> {
 *   return this.orders.findByUser(ctx.userId);
 * }
 * ```
 */
export function ToolContext(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      throw new Error(toolContextOutsideMethod());
    }

    // Own metadata only: a subclass redeclaring a method starts afresh.
    Reflect.defineMetadata(
      TOOL_CONTEXT_METADATA,
      [...readContextParams(target, propertyKey), parameterIndex],
      target,
      propertyKey,
    );
  };
}

/**
 * The positions of the parameters `@ToolContext()` marks on a method.
 *
 * @internal
 * @param owner The prototype that defines the method.
 * @param method The method's name.
 * @returns Their indexes, empty when none.
 */
export const readContextParams = (
  owner: object,
  method: string | symbol,
): number[] =>
  Reflect.getOwnMetadata(TOOL_CONTEXT_METADATA, owner, method) ?? [];
