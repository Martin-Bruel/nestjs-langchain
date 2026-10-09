import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';
import { TOOL_METADATA, TOOL_PARAMS_METADATA } from '../constants.js';

/** The options of `@Tool()`. */
export interface ToolOptions {
  /**
   * The name the model calls, the method name by default. Matches
   * `/^[a-zA-Z0-9_-]{1,64}$/` and does not start with `extract-`, which
   * LangChain reserves for structured output.
   */
  name?: string;
  /** What the tool does, which the model reads to decide when to call it. */
  description: string;
}

/**
 * Exposes a provider method as a tool to the agents whose `tools` list its
 * module. A method decorator only: discovery never reads one placed on a
 * class.
 *
 * @param options The tool's description and, optionally, its name.
 * @returns The method decorator.
 * @example
 * ```ts
 * \@Tool({ description: 'Doubles a number.' })
 * double(@ToolParam({ name: 'x' }) x: number): number {
 *   return x * 2;
 * }
 * ```
 */
export const Tool = (options: ToolOptions): MethodDecorator =>
  SetMetadata(TOOL_METADATA, options);

/** The options of `@ToolParam()`. */
export interface ToolParamOptions {
  /** The argument's name in the schema the model fills in. */
  name: string;
  /** What the argument means, read by the model. */
  description?: string;
  /** Required unless the signature resolves to string, number or boolean. */
  schema?: ZodType;
  /** Lets the model leave the argument out; declare the parameter `x?: T`. */
  optional?: boolean;
}

/** What `@ToolParam()` records for one parameter. */
export interface ToolParamMetadata extends ToolParamOptions {
  /** The parameter's position in the method's signature. */
  index: number;
}

/**
 * Declares a parameter of a `@Tool()` method as an argument of the tool.
 *
 * @param options The argument's name and, optionally, its description,
 *   schema and whether it is optional.
 * @returns The parameter decorator.
 * @example
 * ```ts
 * const Tags = z.array(z.string());
 *
 * count(@ToolParam({ name: 'tags', schema: Tags }) tags: string[]): number {
 *   return tags.length;
 * }
 * ```
 */
export function ToolParam(options: ToolParamOptions): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      throw new Error('ToolParam can only be used on method parameters');
    }

    // Own metadata only: a subclass redeclaring a method starts afresh.
    const existing: ToolParamMetadata[] =
      Reflect.getOwnMetadata(TOOL_PARAMS_METADATA, target, propertyKey) ?? [];

    Reflect.defineMetadata(
      TOOL_PARAMS_METADATA,
      [...existing, { ...options, index: parameterIndex }],
      target,
      propertyKey,
    );
  };
}
