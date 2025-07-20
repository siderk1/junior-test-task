import { DynamicModule, Global, Module } from "@nestjs/common";
import { NatsService } from "./nats.service";

@Global()
@Module({})
export class NatsModule {
  static forRoot(natsUrl: string, clientName?: string): DynamicModule {
    return {
      module: NatsModule,
      providers: [
        {
          provide: NatsService,
          useFactory: async () => {
            const service = new NatsService();
            await service.connect(natsUrl, clientName || "default-nats-client");
            return service;
          },
        },
      ],
      exports: [NatsService],
    };
  }
}
