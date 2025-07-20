import * as winston from "winston";
import LokiTransport from "winston-loki";
import { LoggerConfig } from "@repo/shared";

const myFormat = winston.format.printf(
  ({ level, message, timestamp, originalError, stack }) => {
    let errorMeta = "";

    if (originalError || stack) {
      errorMeta = `\n${originalError}\n${stack}`;
    }

    return `${timestamp} - ${level}: ${message}${errorMeta}`;
  },
);

export const createWinstonLogger = ({
  logToConsole,
  lokiUrl,
  logLevel,
  serviceName,
  env,
}: LoggerConfig) => {
  const transports: winston.transport[] = [];

  if (logToConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
          }),
          winston.format.colorize(),
          myFormat,
        ),
      }),
    );
  }

  if (lokiUrl) {
    transports.push(
      new LokiTransport({
        host: lokiUrl,
        labels: {
          service: serviceName,
          env,
        },
        json: true,
        format: winston.format.json(),
      }),
    );
  }

  return winston.createLogger({
    level: logLevel,
    transports,
  });
};
