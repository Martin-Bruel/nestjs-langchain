// The package's public surface. The `exports` map closes every other path, so
// adding a name here is cheap and removing one costs a major. Named rather
// than `export *`, so a new export in a leaf file is a decision, not a leak.
export { LangChainModule } from './langchain.module.js';
export { LangChainService } from './langchain.service.js';
export { InjectAgent, Tool, ToolParam } from './decorators/index.js';
export type { ToolOptions, ToolParamOptions } from './decorators/index.js';
export type {
  AgentObserver,
  ModelErrorEvent,
  RunFinishEvent,
  ToolEndEvent,
  ToolErrorEvent,
  ToolStartEvent,
} from './interfaces/agent-observer.interface.js';
export type {
  AgentCallback,
  LangChainModuleOptions,
  ModelConfig,
  ModelOption,
  ToolModule,
} from './interfaces/langchain-module-options.interface.js';
