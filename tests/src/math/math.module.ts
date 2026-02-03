import { Module } from '@nestjs/common';
import { MathService } from './math.service';

@Module({
  providers: [MathService],
  exports: [MathService],
})
export class MathModule {}
