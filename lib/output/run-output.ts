import { toJsonSchema } from '@langchain/core/utils/json_schema';
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
  outputNotAnObject,
  structuredOutputInvalid,
  structuredOutputMissing,
  structuredOutputMultiple,
} from '../errors/messages.js';
import { messageOf } from '../logging/index.js';

// The default of LangChain's own retry middlewares. See #151.
const MAX_RETRIES = 2;

// Ours rather than LangChain's counter or the schema's title: the same tool on
// every run, and a prefix no `@Tool` can take. See #281.
const OUTPUT_TOOL = 'extract-output';

// LangChain's default for a Zod schema, which its JSON Schema path leaves
// empty. See #282.
const OUTPUT_DESCRIPTION =
  "Tool for extracting structured output from the model's response.";

/**
 * The structured output one run asked for: the strategy its model calls use,
 * and the answer parsed by the schema.
 *
 * @internal
 */
export class RunOutput {
  /**
   * Through a tool, whatever the model (see #274). One per run, which counts
   * its own retries (see #151).
   */
  readonly strategy: TypedToolStrategy;
  /** The tool the model answers through. */
  readonly toolName = OUTPUT_TOOL;
  #retries = 0;
  private readonly prefix: string;

  /**
   * @param schema The run's `output` schema.
   * @param agent The agent's name, for the errors.
   * @throws AgentRunError when the schema has no JSON Schema form, or is not
   * an object with named fields.
   */
  constructor(
    private readonly schema: ZodType,
    private readonly agent: string,
  ) {
    this.prefix = agentPrefix(agent);

    // LangChain's own conversion, run before any model call.
    let json: Record<string, unknown>;

    try {
      json = toJsonSchema(schema);
    } catch (error) {
      throw new AgentRunError(
        noOutputJsonSchemaForm(this.prefix, messageOf(error)),
        agent,
        { cause: error },
      );
    }

    // A tool's parameters. LangChain takes them as a JSON Schema with
    // `properties` at every version, as a Zod schema other than an object at
    // recent ones only. See #282.
    if (json.type !== 'object' || !('properties' in json)) {
      throw new AgentRunError(outputNotAnObject(this.prefix), agent);
    }

    // LangChain names the tool after the title.
    this.strategy = toolStrategy(
      {
        ...json,
        type: 'object',
        title: OUTPUT_TOOL,
        description: json.description ?? OUTPUT_DESCRIPTION,
      },
      { handleError: (error) => this.retry(error) },
    );
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
    // Never LangChain's messages, which name the internal tool.
    if (error instanceof StructuredOutputParsingError) {
      return this.invalid(error.errors.join(' '), error);
    }

    if (error instanceof MultipleStructuredOutputsError) {
      return new StructuredOutputError(
        structuredOutputMultiple(this.prefix, error.toolNames.length),
        this.agent,
        { cause: error },
      );
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
