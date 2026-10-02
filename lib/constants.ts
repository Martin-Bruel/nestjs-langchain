// Namespaced like the other tokens, so another library's marks are not read.
export const TOOL_METADATA = 'nestjs-langchain:tool';
export const TOOL_PARAMS_METADATA = 'nestjs-langchain:tool-params';

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
