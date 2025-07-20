import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { ConfigService } from "./config.service";
import { baseValidationSchema } from "./config.schema";

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      validationSchema: baseValidationSchema,
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
