import { Injectable } from '@nestjs/common';
import { LangChainService } from 'nestjs-langchain';

@Injectable()
export class AppService {
  constructor(private readonly agent: LangChainService) {}

  async writeAPoemOn(topic: string): Promise<string> {
    return this.agent.run(`Write a poem about ${topic}`);
  }
}
