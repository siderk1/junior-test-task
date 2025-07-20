import { Module } from '@nestjs/common';
import { PrismaModule } from '@repo/prisma';
import { NatsModule } from '@repo/nats-wrapper';
import { FbCollectorService } from './fb-collector.service';
import { MetricsModule } from '../metrics/metrics.module';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [MetricsModule, NatsModule, PrismaModule, LoggerModule],
  providers: [FbCollectorService],
  exports: [FbCollectorService]
})
export class FbCollectorModule {}
