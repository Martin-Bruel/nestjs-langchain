import { Injectable } from '@nestjs/common';
import { Agent } from 'nestjs-langchain';

@Injectable()
export class AppService {
  constructor(private readonly agent: Agent) {}

  async writeAPoemOn(topic: string): Promise<string> {
    return this.agent.run(`Write a poem about ${topic}`);
  }
}
