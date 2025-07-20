import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';

@Module({
  providers: [MetricsService],
  exports: [MetricsService],
  controllers: [MetricsController]
})
export class MetricsModule {}
