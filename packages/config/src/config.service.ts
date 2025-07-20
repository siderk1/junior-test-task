import { Injectable } from "@nestjs/common";
import { ConfigService as NestConfigService } from "@nestjs/config";
import { AppConfig, LoggerConfig } from "@repo/shared";

@Injectable()
export class ConfigService {
  readonly app: AppConfig;
  readonly logger: LoggerConfig;

  constructor(private readonly configService: NestConfigService) {
    this.app = {
      port: this.configService.getOrThrow("APP_PORT"),
    };

    this.logger = {
      lokiUrl: this.configService.getOrThrow("LOKI_URL"),
      env: this.configService.getOrThrow("NODE_ENV"),
      logLevel: this.configService.getOrThrow("LOG_LEVEL"),
      serviceName: this.configService.getOrThrow("SERVICE_NAME"),
      logToConsole: this.configService.getOrThrow("LOG_TO_CONSOLE"),
    };
  }
}
