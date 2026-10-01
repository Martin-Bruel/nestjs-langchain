import { Type } from '@nestjs/common';
import z, { ZodObject, ZodType } from 'zod';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import {
  cannotInferSchema,
  schemaContradictsSignature,
} from '../errors/messages.js';

const INFERRED = new Map<unknown, () => ZodType>([
  [String, () => z.string()],
  [Number, () => z.number()],
  [Boolean, () => z.boolean()],
]);

// The JSON Schema types each primitive signature accepts, the first naming it.
// `integer` is a subset of `number`.
const JSON_SCHEMA_TYPES = new Map<unknown, string[]>([
  [String, ['string']],
  [Number, ['number', 'integer']],
  [Boolean, ['boolean']],
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

    throw new Error(cannotInferSchema(where, param.name, declared));
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
  const accepted = JSON_SCHEMA_TYPES.get(paramType);

  if (!accepted) {
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

  if (types.some((type) => accepted.includes(type))) {
    return;
  }

  throw new Error(
    schemaContradictsSignature(where, param.name, types, accepted[0]),
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
