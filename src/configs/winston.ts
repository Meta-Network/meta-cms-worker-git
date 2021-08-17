import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  WinstonModuleOptions,
  WinstonModuleOptionsFactory,
} from 'nest-winston';
import * as winston from 'winston';

const defaultLogFormat = (appName: string) =>
  winston.format.combine(
    winston.format.label({ label: appName }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label', 'stack'],
    }),
  );
const consoleLogFormat = winston.format.printf((info) => {
  const { label, timestamp, level, stack, message, ms } = info;
  const ctx = info.metadata.context;
  return `\x1B[32m[${label}]  -\x1B[39m ${timestamp}     ${level} \x1B[33m[${ctx}]\x1B[39m ${message}${
    stack ? ' \x1B[31m' + stack + '\x1B[39m' : ''
  } \x1B[33m${ms}\x1B[39m`;
});

@Injectable()
export class WinstonConfigService implements WinstonModuleOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  async createWinstonModuleOptions(): Promise<WinstonModuleOptions> {
    const appName = this.configService.get<string>('app.name');
    const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
    const logDir = `/var/log/${appName.toLowerCase()}`;

    return {
      level,
      format: defaultLogFormat(appName),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'MM/DD/YYYY, hh:mm:ss A' }),
            winston.format.ms(),
            winston.format.errors({ stack: true }),
            consoleLogFormat,
          ),
        }),
        new winston.transports.File({
          filename: `${logDir}/${level}-${Date.now()}.log`,
          format: winston.format.combine(winston.format.json()),
        }),
        new winston.transports.File({
          level: 'error',
          filename: `${logDir}/error-${Date.now()}.log`,
          format: winston.format.combine(winston.format.json()),
        }),
      ],
      exitOnError: false,
    };
  }
}
