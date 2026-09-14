import { Inject } from '@nestjs/common';
import { getAgentToken } from '../langchain.module-definition.js';

export const InjectAgent = (name: string) => Inject(getAgentToken(name));
