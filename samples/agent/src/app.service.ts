import { InjectAgent, Agent } from 'nestjs-langchain';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @InjectAgent('MONGO') private readonly dbaAgentService: Agent,
    @InjectAgent('MATH') private readonly mathAgentService: Agent,
  ) {}

  async dba(input: string): Promise<string> {
    const { output } = await this.dbaAgentService.run(input);
    return output;
  }

  async calculate(input: string): Promise<string> {
    const { output } = await this.mathAgentService.run(input);
    return output;
  }
}
