// Namespaced like the other tokens, so another library's marks are not read.
export const TOOL_METADATA = 'nestjs-langchain:tool';
export const TOOL_PARAMS_METADATA = 'nestjs-langchain:tool-params';

// Emitted by `emitDecoratorMetadata` on every decorated method.
export const PARAM_TYPES_METADATA = 'design:paramtypes';

// The keys `@Module()` writes, restated: `@nestjs/common/constants` is
// internal. See #97.
export const MODULE_METADATA_KEYS = [
  'imports',
  'providers',
  'controllers',
  'exports',
];
