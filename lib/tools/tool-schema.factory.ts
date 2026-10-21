import { Type } from '@nestjs/common';
import { toJsonSchema } from '@langchain/core/utils/json_schema';
import z, { ZodObject, ZodType } from 'zod';
import { ToolParamMetadata } from '../decorators/tool.decorator.js';
import {
  cannotInferSchema,
  duplicateParamName,
  noJsonSchemaForm,
  schemaContradictsSignature,
} from '../errors/messages.js';
import { messageOf } from '../logging/index.js';

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

interface JsonSchemaNode {
  type?: string | string[];
  anyOf?: JsonSchemaNode[];
}

// The JSON Schema types a schema allows, from its `type` or from the branches
// of its `anyOf`: zod 4 gives a union either form (see #137). `undefined` when
// it has no JSON Schema form, or a branch names no type.
const typesOf = (schema: ZodType): string[] | undefined => {
  let node: JsonSchemaNode;

  try {
    node = z.toJSONSchema(schema);
  } catch {
    return undefined;
  }

  const branches = node.type === undefined && node.anyOf ? node.anyOf : [node];

  if (branches.some((branch) => branch.type === undefined)) {
    return undefined;
  }

  return branches.flatMap((branch) => branch.type ?? []);
};

// A declared schema LangChain cannot convert to the JSON Schema a provider
// receives. Wrapped in an object, as LangChain converts a tool's schema: only
// there does it read the input side of a `.transform()`.
const checkJsonSchemaForm = (
  param: ToolParamMetadata,
  schema: ZodType,
  where: string,
): void => {
  try {
    toJsonSchema(z.object({ [param.name]: schema }));
  } catch (error) {
    throw new Error(noJsonSchemaForm(where, param.name, messageOf(error)));
  }
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
  const types = accepted && typesOf(schema);

  if (!accepted || !types || types.some((type) => accepted.includes(type))) {
    return;
  }

  throw new Error(
    schemaContradictsSignature(where, param.name, types, accepted[0]),
  );
};

const describe = (schema: ZodType, description: string | undefined) =>
  description ? schema.describe(description) : schema;

// A transform that throws on `null` received it: the schema let it through.
const acceptsNull = (schema: ZodType): boolean => {
  try {
    return schema.safeParse(null).success;
  } catch {
    return true;
  }
};

// Sent required and nullable, which strict mode accepts: a `null` or an
// omitted key reaches the method as `undefined`. Unless the schema already
// gives `null` a meaning. LangChain leaves `.transform()` out of what the
// model sees. See #269.
const optional = (schema: ZodType, description: string | undefined): ZodType =>
  acceptsNull(schema)
    ? describe(schema, description).optional()
    : describe(schema.nullable().default(null), description).transform(
        (value) => value ?? undefined,
      );

export const buildToolSchema = (
  params: ToolParamMetadata[],
  paramTypes: unknown[],
  where: string,
): ZodObject => {
  const shape: Record<string, ZodType> = {};
  const indexes = new Map<string, number>();

  params.forEach((param) => {
    const first = indexes.get(param.name);

    if (first !== undefined) {
      throw new Error(
        duplicateParamName(where, param.name, first, param.index),
      );
    }

    indexes.set(param.name, param.index);

    const resolved = resolveSchema(param, paramTypes[param.index], where);

    if (param.schema) {
      checkJsonSchemaForm(param, resolved, where);
      checkAgainstSignature(param, paramTypes[param.index], resolved, where);
    }

    shape[param.name] = param.optional
      ? optional(resolved, param.description)
      : describe(resolved, param.description);
  });

  return z.object(shape);
};
