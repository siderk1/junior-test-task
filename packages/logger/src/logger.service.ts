import { Injectable } from "@nestjs/common";
import { Logger } from "winston";
import { ConfigService } from "@repo/config";
import { createWinstonLogger } from "./logger.config";

@Injectable()
export class LoggerService {
  private readonly logger: Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = createWinstonLogger(configService.logger);
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug(msg, meta);
  }

  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.info(msg, meta);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn(msg, meta);
  }

  error(msg: string, error?: Error, meta?: Record<string, unknown>): void {
    const loggerMeta = meta ? { ...meta } : {};

    if (error) {
      loggerMeta.stack = error.stack;
      loggerMeta.originalError = error.message;
    }

    this.logger.error(msg, loggerMeta);
  }
}
