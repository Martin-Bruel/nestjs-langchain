import { Body, Controller, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('calculator')
  async calculator(@Body() dto: { input: string }): Promise<string> {
    return await this.appService.calculate(dto.input);
  }

  @Post('dba')
  async dba(@Body() dto: { input: string }): Promise<string> {
    return await this.appService.dba(dto.input);
  }
}
