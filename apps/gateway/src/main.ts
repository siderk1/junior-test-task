import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@repo/config';
import { NatsService } from '@repo/nats-wrapper';
import { json } from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false
  });

  const configService = app.get(ConfigService);
  const port = configService.app.port;

  app.use(json({ limit: '30mb' }));

  const nats = app.get(NatsService);
  await nats.connect(
    process.env.NATS_URL || 'nats://nats:4222',
    'gateway-nats-client'
  );

  await app.listen(port);
}
bootstrap();
