import { Module } from '@nestjs/common';
import { PrismaModule } from '@repo/prisma';
import { NatsModule } from '@repo/nats-wrapper';
import { MetricsModule } from '../metrics/metrics.module';
import { TtkCollectorService } from './ttk-collector.service';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [MetricsModule, NatsModule, PrismaModule, LoggerModule],
  providers: [TtkCollectorService],
  exports: [TtkCollectorService]
})
export class TtkCollectorModule {}
