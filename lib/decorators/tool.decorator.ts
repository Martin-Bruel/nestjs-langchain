import { SetMetadata } from '@nestjs/common';

export const TOOL_METADATA = 'TOOL_METADATA';
export const TOOL_PARAM_METADATA = 'TOOL_PARAM_METADATA';

export interface ToolOptions {
  description: string;
}

export const Tool = (options: ToolOptions) =>
  SetMetadata(TOOL_METADATA, options);

export interface ToolParamOptions {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
}

export const TOOL_PARAMS_METADATA = 'LANGCHAIN_TOOL_PARAMS';

export function ToolParam(options: ToolParamOptions): ParameterDecorator {
  return (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) => {
    if (propertyKey === undefined) {
      throw new Error('ToolParam can only be used on method parameters');
    }
    const existingParams =
      Reflect.getMetadata(TOOL_PARAMS_METADATA, target, propertyKey) || [];

    // On enregistre l'index pour savoir quel argument remplir plus tard
    existingParams.push({ ...options, index: parameterIndex });

    Reflect.defineMetadata(
      TOOL_PARAMS_METADATA,
      existingParams,
      target,
      propertyKey,
    );
  };
}
