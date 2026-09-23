export const TOOL_METADATA = 'TOOL_METADATA';
export const TOOL_PARAMS_METADATA = 'LANGCHAIN_TOOL_PARAMS';

// Emitted by `emitDecoratorMetadata` on every decorated method.
export const PARAM_TYPES_METADATA = 'design:paramtypes';

// The keys `@Module()` writes. Restated rather than imported from
// `@nestjs/common/constants`, an internal subpath of a peer dependency.
export const MODULE_METADATA_KEYS = [
  'imports',
  'providers',
  'controllers',
  'exports',
];
