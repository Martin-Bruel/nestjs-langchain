import { Injectable } from '@nestjs/common';
import { Tool, ToolParam } from '../../../lib/decorators/tool.decorator';

@Injectable()
export class MathService {
  @Tool({ description: 'Adds two numbers together.' })
  add(
    @ToolParam({
      name: 'a',
      description: 'The first number to add.',
      type: 'number',
    })
    a: number,
    @ToolParam({
      name: 'b',
      description: 'The second number to add.',
      type: 'number',
    })
    b: number,
  ): number {
    return a + b;
  }

  noToolMethod(): string {
    return 'This method is not a tool.';
  }
}
