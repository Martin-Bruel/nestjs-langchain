import { Module } from '@nestjs/common';
import { MathService } from './math.service.js';

@Module({
  providers: [MathService],
  exports: [MathService],
})
export class MathModule {}
