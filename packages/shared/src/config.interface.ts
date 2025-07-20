export interface AppConfig {
  port: number;
}
export interface DBConfig {
  uri: string;
}

export interface LoggerConfig {
  lokiUrl: string;
  env: string;
  logLevel: string;
  serviceName: string;
  logToConsole: boolean;
}
