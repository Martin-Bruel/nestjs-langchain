import { Inject } from '@nestjs/common';
import { getAgentToken } from '../langchain.module-definition.js';

/**
 * Injects the agent registered under `name`. The agent registered without a
 * name is injected as `Agent`, with no decorator.
 *
 * @param name The `name` the agent was registered with.
 * @returns The parameter decorator.
 * @example
 * ```ts
 * constructor(@InjectAgent('MATH_AGENT') private readonly math: Agent) {}
 * ```
 */
export const InjectAgent = (name: string) => Inject(getAgentToken(name));
