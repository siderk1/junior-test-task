import { Module } from '@nestjs/common';
import { ConfigModule } from '@repo/config';
import { NatsModule } from '@repo/nats-wrapper';
import { MetricsModule } from './metrics/metrics.module';
import { GatewayModule } from './gateway/gateway.module';
import { AppController } from './app.controller';
import { LoggerModule } from '@repo/logger';

@Module({
  imports: [
    MetricsModule,
    ConfigModule,
    NatsModule.forRoot(
      process.env.NATS_URL || 'nats://nats:4222',
      'fb-collector-nats-client'
    ),
    GatewayModule,
    LoggerModule
  ],
  controllers: [AppController]
})
export class AppModule {}
