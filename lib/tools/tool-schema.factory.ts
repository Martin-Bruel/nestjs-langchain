import { Type } from '@nestjs/common';
import z, { ZodObject, ZodType } from 'zod';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';

const INFERRED = new Map<unknown, () => ZodType>([
  [String, () => z.string()],
  [Number, () => z.number()],
  [Boolean, () => z.boolean()],
]);

const JSON_SCHEMA_TYPE = new Map<unknown, string>([
  [String, 'string'],
  [Number, 'number'],
  [Boolean, 'boolean'],
]);

const resolveSchema = (
  param: ToolParamMetadata,
  paramType: unknown,
  where: string,
): ZodType => {
  if (param.schema) {
    return param.schema;
  }

  const inferred = INFERRED.get(paramType);

  if (!inferred) {
    const declared = (paramType as Type | undefined)?.name ?? 'unknown';
    throw new Error(
      `${where}: cannot infer a schema for "${param.name}" declared as ${declared}. ` +
        'Pass a `schema` to @ToolParam, or use string, number or boolean.',
    );
  }

  return inferred();
};

// A declared schema that contradicts a primitive signature. Skipped for any
// other signature, where the schema is the only source of truth.
const checkAgainstSignature = (
  param: ToolParamMetadata,
  paramType: unknown,
  schema: ZodType,
  where: string,
): void => {
  const expected = JSON_SCHEMA_TYPE.get(paramType);

  if (!expected) {
    return;
  }

  let declared: unknown;

  try {
    declared = (z.toJSONSchema(schema) as { type?: unknown }).type;
  } catch {
    return;
  }

  if (declared === undefined) {
    return;
  }

  const types = Array.isArray(declared) ? declared : [declared];

  if (types.includes(expected)) {
    return;
  }

  throw new Error(
    `${where}: the schema for "${param.name}" describes ${types.join(' | ')} ` +
      `but the signature declares ${expected}.`,
  );
};

export const buildToolSchema = (
  params: ToolParamMetadata[],
  paramTypes: unknown[],
  where: string,
): ZodObject => {
  const shape: Record<string, ZodType> = {};

  params.forEach((param) => {
    const resolved = resolveSchema(param, paramTypes[param.index], where);

    if (param.schema) {
      checkAgainstSignature(param, paramTypes[param.index], resolved, where);
    }

    const described = param.description
      ? resolved.describe(param.description)
      : resolved;

    shape[param.name] = param.optional ? described.optional() : described;
  });

  return z.object(shape);
};
