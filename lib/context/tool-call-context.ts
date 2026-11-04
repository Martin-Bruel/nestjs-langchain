/**
 * What a `@ToolContext()` parameter receives, for one tool call. Fields may
 * join it in a minor release, under LangChain's names.
 *
 * @example
 * ```ts
 * \@Tool({ description: 'Lists the orders of the current user.' })
 * listOrders(
 *   \@ToolContext() { context, signal }: ToolCallContext<{ userId: string }>,
 * ) {
 *   return this.http.get(`/orders/${context.userId}`, { signal });
 * }
 * ```
 */
export class ToolCallContext<TContext = unknown> {
  /** @internal Built by the library for each tool call. */
  constructor(
    /**
     * The run's `context`, as passed, or the one of the run it is nested in:
     * `undefined` when it has none.
     */
    readonly context: TContext,
    /** Aborts with the run: pass it on to stop the tool's own work. */
    readonly signal: AbortSignal,
  ) {}
}
