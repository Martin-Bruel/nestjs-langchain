import { SetMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';
import { TOOL_METADATA, TOOL_PARAMS_METADATA } from '../constants.js';

export interface ToolOptions {
  // Defaults to the method name. Must match /^[a-zA-Z0-9_-]{1,64}$/.
  name?: string;
  description: string;
}

export const Tool = (options: ToolOptions) =>
  SetMetadata(TOOL_METADATA, options);

export interface ToolParamOptions {
  name: string;
  description?: string;
  // Required unless the signature resolves to string, number or boolean.
  schema?: ZodType;
  optional?: boolean;
}

export interface ToolParamMetadata extends ToolParamOptions {
  index: number;
}

export function ToolParam(options: ToolParamOptions): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) {
      throw new Error('ToolParam can only be used on method parameters');
    }

    const existing: ToolParamMetadata[] =
      Reflect.getMetadata(TOOL_PARAMS_METADATA, target, propertyKey) ?? [];

    Reflect.defineMetadata(
      TOOL_PARAMS_METADATA,
      [...existing, { ...options, index: parameterIndex }],
      target,
      propertyKey,
    );
  };
}
