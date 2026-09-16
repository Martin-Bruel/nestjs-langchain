import { Injectable, Type } from '@nestjs/common';
// From `langchain`, not `@langchain/core`: core's declaration gives an
// identity `createAgent` rejects. See #52.
import { DynamicStructuredTool } from 'langchain';
import {
  TOOL_METADATA,
  TOOL_PARAMS_METADATA,
  ToolOptions,
  ToolParamMetadata,
} from './decorators/tool.decorator.js';
import z, { ZodType } from 'zod';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';

// Emitted by `emitDecoratorMetadata` on every decorated method.
const PARAM_TYPES_METADATA = 'design:paramtypes';

const INFERRED = new Map<unknown, () => ZodType>([
  [String, () => z.string()],
  [Number, () => z.number()],
  [Boolean, () => z.boolean()],
]);

// OpenAI's limit, the strictest published. No provider SDK exports it as a
// value, so it is restated here rather than imported.
const TOOL_NAME = /^[a-zA-Z0-9_-]{1,64}$/;

const JSON_SCHEMA_TYPE = new Map<unknown, string>([
  [String, 'string'],
  [Number, 'number'],
  [Boolean, 'boolean'],
]);

@Injectable()
export class ToolDiscoveryService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  private resolveSchema(
    param: ToolParamMetadata,
    paramType: unknown,
    where: string,
  ): ZodType {
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
  }

  // A declared schema that contradicts a primitive signature. Skipped for any
  // other signature, where the schema is the only source of truth.
  private checkAgainstSignature(
    param: ToolParamMetadata,
    paramType: unknown,
    schema: ZodType,
    where: string,
  ): void {
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
  }

  private resolveToolName(
    declared: string | undefined,
    method: string,
    where: string,
  ): string {
    const name = declared ?? method;

    if (!TOOL_NAME.test(name)) {
      throw new Error(
        `${where}: "${name}" is not a valid tool name, providers match ` +
          `${String(TOOL_NAME)}` +
          (declared ? '.' : '. Pass a `name` to @Tool().'),
      );
    }

    return name;
  }

  private buildSchema(
    params: ToolParamMetadata[],
    paramTypes: unknown[],
    where: string,
  ) {
    const shape: Record<string, ZodType> = {};

    params.forEach((param) => {
      const resolved = this.resolveSchema(
        param,
        paramTypes[param.index],
        where,
      );

      if (param.schema) {
        this.checkAgainstSignature(
          param,
          paramTypes[param.index],
          resolved,
          where,
        );
      }

      const described = param.description
        ? resolved.describe(param.description)
        : resolved;

      shape[param.name] = param.optional ? described.optional() : described;
    });

    return z.object(shape);
  }

  getToolsFromModules(allowedModules: Type[]): DynamicStructuredTool[] {
    const providers = this.discoveryService.getProviders();

    // Compare constructors, not `host.name`. A class name is not an identity:
    // two modules named `ToolsModule` would be indistinguishable.
    const allowed = new Set<Type>(allowedModules);

    const tools: DynamicStructuredTool[] = [];
    providers.forEach((wrapper) => {
      const { instance, host } = wrapper;

      if (!instance || !host || !allowed.has(host.metatype)) {
        return;
      }
      const methodNames = this.metadataScanner.getAllMethodNames(
        Object.getPrototypeOf(instance),
      );

      methodNames.forEach((name) => {
        // Undefined on every method without `@Tool()`, which is what the
        // guard below filters on.
        const metadata: ToolOptions | undefined = Reflect.getMetadata(
          TOOL_METADATA,
          instance[name],
        );

        if (!metadata) {
          return;
        }

        // Parameter decorators run right to left. Sorted here so the schema
        // lists the parameters in declaration order.
        const paramsMeta: ToolParamMetadata[] = [
          ...(Reflect.getMetadata(TOOL_PARAMS_METADATA, instance, name) ?? []),
        ].sort((a, b) => a.index - b.index);
        const paramTypes: unknown[] =
          Reflect.getMetadata(PARAM_TYPES_METADATA, instance, name) ?? [];

        const where = `${instance.constructor.name}.${name}`;

        tools.push(
          new DynamicStructuredTool({
            name: this.resolveToolName(metadata.name, name, where),
            description: metadata.description,
            schema: this.buildSchema(paramsMeta, paramTypes, where),
            func: (values: Record<string, unknown>) => {
              // Placed by index: an omitted optional leaves a hole rather
              // than shifting the arguments after it.
              const args: unknown[] = [];
              paramsMeta.forEach((param) => {
                args[param.index] = values[param.name];
              });

              return instance[name](...args);
            },
          }),
        );
      });
    });

    return tools;
  }
}
