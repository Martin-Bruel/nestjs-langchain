import { Injectable } from '@nestjs/common';
import { Agent } from 'nestjs-langchain';

@Injectable()
export class AppService {
  constructor(private readonly agent: Agent) {}

  async writeAPoemOn(topic: string): Promise<string> {
    const { output } = await this.agent.run(`Write a poem about ${topic}`);
    return output;
  }
}
