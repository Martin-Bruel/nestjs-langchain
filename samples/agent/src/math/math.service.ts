import { Tool, ToolParam } from 'nestjs-langchain';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MathService {
  @Tool({ description: 'Binary operation.' })
  calculator(
    @ToolParam({
      name: 'a',
      description: 'The first number.',
      type: 'number',
    })
    a: number,
    @ToolParam({
      name: 'op',
      description: 'The operation to perform. (Allowed: +, -, *, /)',
      type: 'string',
    })
    op: string,
    @ToolParam({
      name: 'b',
      description: 'The second number.',
      type: 'number',
    })
    b: number,
  ): number {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return a / b;
      default:
        throw new Error(`Unsupported operation: ${op}`);
    }
  }
}
