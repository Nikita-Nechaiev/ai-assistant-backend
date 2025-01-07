import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiToolUsage } from './ai-tool-usage.model';
import { AiToolUsageController } from './ai-tool-usage.controller';
import { AiToolUsageService } from './ai-tool-usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([AiToolUsage])],
  controllers: [AiToolUsageController],
  providers: [AiToolUsageService],
  exports: [AiToolUsageService],
})
export class AiToolUsageModule {}
