import fs from 'fs';
import os from 'os';
import path from 'path';
import pino, { P } from 'pino';
import process from 'process';

import { config } from '../configs';
import { isProd } from '../utils';

type DestinationOptions = {
  destination: string | number;
};

class LoggerService {
  public constructor() {
    const appName = config.get<string>('app.name');
    const dirName = appName.toLowerCase();
    const baseDir = fs.mkdtempSync(`${path.join(os.tmpdir(), dirName)}-`);
    const level = this.mkLevel(process.env.DEBUG || 'debug');

    const prettyTarget: P.TransportTargetOptions<P.PrettyOptions> = {
      level,
      target: '#pino/pretty',
      options: config.get<P.PrettyOptions>('logger.prettyPrint'),
    };

    const targets: P.TransportTargetOptions<
      DestinationOptions | P.PrettyOptions
    >[] = [
      {
        level,
        target: '#pino/file',
        options: { destination: `${baseDir}/${level}.log` },
      },
      {
        level: 'error',
        target: '#pino/file',
        options: { destination: `${baseDir}/error.log` },
      },
    ];

    if (!isProd()) targets.push(prettyTarget);

    const transports = pino.transport<DestinationOptions | P.PrettyOptions>({
      targets,
    });

    const _logger = pino({ name: appName }, transports);

    this.logDir = baseDir;

    this.logger = _logger;

    this.final = pino.final(_logger, (error, finalLogger, event: string) => {
      finalLogger.info(`${event} caught, the process was exit`);
      if (error instanceof Error) finalLogger.error(error);
      finalLogger.info(`Uploading log files from ${this.logDir}`);
      // TODO: Some log upload task
      process.exit(error ? 1 : 0);
    });

    this.logger.info(`Log files saved to ${baseDir}`);
  }

  private readonly logDir: string;
  readonly logger: P.Logger;
  readonly final: (error?: Error | string | null, ...args: any[]) => void;

  private mkLevel(l: string): P.LevelWithSilent {
    const levelArr = [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ];
    if (levelArr.includes(l)) {
      return l as P.LevelWithSilent;
    }
    if (isProd()) return 'info';
    return 'trace';
  }
}

export const loggerService = new LoggerService();

export const logger = loggerService.logger;
