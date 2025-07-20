import { Module } from '@nestjs/common';
import { NatsModule } from '@repo/nats-wrapper';
import { MetricsModule } from '../metrics/metrics.module';
import { GatewayController } from './gateway.controller';
import { GatewayService } from './gateway.service';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [MetricsModule, NatsModule, LoggerModule],
  controllers: [GatewayController],
  providers: [GatewayService],
  exports: [GatewayService]
})
export class GatewayModule {}
