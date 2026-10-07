import {
  PARAM_TYPES_METADATA,
  TOOL_METADATA,
  TOOL_PARAMS_METADATA,
} from '../constants.js';
import {
  ToolOptions,
  ToolParamMetadata,
} from '../decorators/tool.decorator.js';
import { toolParamWithoutTool } from '../errors/messages.js';

type Provider = Record<string, (...args: unknown[]) => unknown>;

/** A provider method decorated with `@Tool()`, and what its decorators recorded. */
export interface ToolMethod {
  /** `MathService.add`, to name the method in error messages. */
  where: string;
  /** The method name, the tool's name when `options` gives none. */
  method: string;
  options: ToolOptions;
  /** The `@ToolParam()` metadata, in declaration order. */
  params: ToolParamMetadata[];
  /** The declared parameter types, from TypeScript's `design:paramtypes`. */
  paramTypes: unknown[];
  /** Calls the method on its provider, with its arguments by position. */
  call: (args: unknown[]) => unknown;
}

// The prototype that defines `method`: its metadata belongs to the function
// `instance[method]` resolves to, the one carrying `@Tool()` or not.
const definingPrototype = (instance: object, method: string): object => {
  let prototype: object | null = Object.getPrototypeOf(instance);

  while (
    prototype &&
    !Object.prototype.hasOwnProperty.call(prototype, method)
  ) {
    prototype = Object.getPrototypeOf(prototype);
  }

  return prototype ?? instance;
};

/**
 * Reads `method` of a provider instance, or `undefined` if it is not a
 * `@Tool()`. Throws when it carries a `@ToolParam()` but no `@Tool()`.
 */
export const readToolMethod = (
  instance: object,
  method: string,
): ToolMethod | undefined => {
  const provider = instance as Provider;
  const options: ToolOptions | undefined = Reflect.getMetadata(
    TOOL_METADATA,
    provider[method],
  );

  const owner = definingPrototype(instance, method);
  const declared: ToolParamMetadata[] =
    Reflect.getOwnMetadata(TOOL_PARAMS_METADATA, owner, method) ?? [];
  const where = `${instance.constructor.name}.${method}`;

  if (!options) {
    if (declared.length > 0) {
      throw new Error(toolParamWithoutTool(where));
    }

    return undefined;
  }

  return {
    where,
    method,
    options,
    // Parameter decorators run right to left.
    params: [...declared].sort((a, b) => a.index - b.index),
    paramTypes:
      Reflect.getOwnMetadata(PARAM_TYPES_METADATA, owner, method) ?? [],
    call: (args) => provider[method](...args),
  };
};
