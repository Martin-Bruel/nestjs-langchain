import {
  MultipleStructuredOutputsError,
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

/**
 * The structured output one run asked for: the strategy its model calls use,
 * and the answer parsed by the schema.
 *
 * @internal
 */
export class RunOutput {
  /**
   * Through a tool, whatever the model (see #274). One per run, so that its
   * tool keeps its name across retries (see #151).
   */
  readonly strategy: TypedToolStrategy;
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

    // Converts the schema to JSON Schema, before any model call.
    try {
      this.strategy = toolStrategy(schema, {
        handleError: (error) => this.retry(error),
      });
    } catch (error) {
      throw new AgentRunError(
        noOutputJsonSchemaForm(this.prefix, messageOf(error)),
        agent,
        { cause: error },
      );
    }
  }

  /** The tool the model answers through. */
  get toolName(): string | undefined {
    return this.strategy[0]?.name;
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
