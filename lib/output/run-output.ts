import { toJsonSchema } from '@langchain/core/utils/json_schema';
import {
  MultipleStructuredOutputsError,
  ProviderStrategy,
  providerStrategy,
  StructuredOutputParsingError,
  toolStrategy,
  TypedToolStrategy,
} from 'langchain';
import z, { ZodType } from 'zod';
import { AgentRunError, StructuredOutputError } from '../errors/index.js';
import {
  agentPrefix,
  noOutputJsonSchemaForm,
  structuredOutputInvalid,
  structuredOutputMissing,
} from '../errors/messages.js';
import { messageOf } from '../logging/index.js';

// The default of LangChain's own retry middlewares. See #151.
const MAX_RETRIES = 2;

type Strategy = TypedToolStrategy | ProviderStrategy;

// LangChain's own rule, which it does not export
// (`hasSupportForJsonSchemaOutput`).
const supportsNativeOutput = (model: object): boolean =>
  (model as { profile?: { structuredOutput?: boolean } }).profile
    ?.structuredOutput === true;

/**
 * The structured output one run asked for: the strategy its model calls use,
 * and the answer parsed by the schema.
 *
 * @internal
 */
export class RunOutput {
  #strategy?: Strategy;
  #retries = 0;
  private readonly prefix: string;

  /**
   * @param schema The run's `output` schema.
   * @param agent The agent's name, for the errors.
   * @throws AgentRunError when the schema has no JSON Schema form.
   */
  constructor(
    private readonly schema: ZodType,
    private readonly agent: string,
  ) {
    this.prefix = agentPrefix(agent);

    // The conversion the strategies run, before any model call.
    try {
      toJsonSchema(schema);
    } catch (error) {
      throw new AgentRunError(
        noOutputJsonSchemaForm(this.prefix, messageOf(error)),
        agent,
        { cause: error },
      );
    }
  }

  /**
   * The strategy of the run, built on its first model call and kept: rebuilt
   * on each call, its tool would be renamed, and a retry under the previous
   * name lost. See #151.
   *
   * @param model The model of the call, which tells if it answers natively.
   * @returns What the call's `responseFormat` becomes.
   */
  strategyFor(model: object): Strategy {
    this.#strategy ??= supportsNativeOutput(model)
      ? providerStrategy(this.schema)
      : toolStrategy(this.schema, {
          handleError: (error) => this.retry(error),
        });

    return this.#strategy;
  }

  /** The tool the model answers through, under the `tool` strategy. */
  get toolName(): string | undefined {
    return Array.isArray(this.#strategy) ? this.#strategy[0]?.name : undefined;
  }

  // What LangChain sends back by default, until the retries run out.
  private retry(error: Error): string {
    this.#retries += 1;

    if (this.#retries > MAX_RETRIES) {
      throw error;
    }

    return error.message;
  }

  /**
   * @param error What a model call threw.
   * @returns A `StructuredOutputError` for LangChain's parsing failures, the
   * error itself otherwise.
   */
  failure(error: unknown): unknown {
    // Its reasons, not its message, which names LangChain's internal tool.
    if (error instanceof StructuredOutputParsingError) {
      return this.invalid(error.errors.join(' '), error);
    }

    if (error instanceof MultipleStructuredOutputsError) {
      return this.invalid(error.message, error);
    }

    return error;
  }

  /**
   * @param structuredResponse What the run left in `structuredResponse`.
   * @returns The answer, as the schema parses it.
   * @throws StructuredOutputError when the answer is missing or invalid.
   */
  read(structuredResponse: unknown): unknown {
    if (structuredResponse === undefined) {
      throw new StructuredOutputError(
        structuredOutputMissing(this.prefix),
        this.agent,
      );
    }

    // LangChain checks the JSON Schema only: Zod also applies transforms and
    // refinements. See #151.
    const parsed = this.schema.safeParse(structuredResponse);

    if (!parsed.success) {
      throw this.invalid(z.prettifyError(parsed.error), parsed.error);
    }

    return parsed.data;
  }

  private invalid(reason: string, cause: unknown): StructuredOutputError {
    return new StructuredOutputError(
      structuredOutputInvalid(this.prefix, reason),
      this.agent,
      { cause },
    );
  }
}
