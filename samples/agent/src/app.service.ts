import { InjectAgent, LangChainService } from 'nestjs-langchain';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    @InjectAgent('MONGO') private readonly dbaAgentService: LangChainService,
    @InjectAgent('MATH') private readonly mathAgentService: LangChainService,
  ) {}

  async dba(input: string): Promise<string> {
    return await this.dbaAgentService.run(input);
  }

  async calculate(input: string): Promise<string> {
    return await this.mathAgentService.run(input);
  }
}
