import { Tool, ToolParam } from 'nestjs-langchain';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';

@Injectable()
export class MathService {
  @Tool({ description: 'Binary operation.' })
  calculator(
    @ToolParam({ name: 'a', description: 'The first number.' })
    a: number,
    @ToolParam({
      name: 'op',
      description: 'The operation to perform.',
      schema: z.enum(['+', '-', '*', '/']),
    })
    op: '+' | '-' | '*' | '/',
    @ToolParam({ name: 'b', description: 'The second number.' })
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
    }
  }
}
