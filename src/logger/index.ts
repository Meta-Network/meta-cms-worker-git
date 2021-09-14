import { LoggerService, LoggerServiceOptions } from '@metaio/worker-common';

import { config } from '../configs';

const getLogger = (): LoggerService => {
  const appName = config.get<string>('app.name', 'app');
  const hostName = config.get<string>('HOSTNAME');
  if (!hostName) throw Error('Can not find HOSTNAME env');
  const secret = config.get<string>('WORKER_SECRET');
  if (!secret) throw Error('Can not find WORKER_SECRET env');
  const lokiUrl = config.get<string>('loki.host');
  if (!lokiUrl) throw Error('Can not find loki host config');

  const _host = config.get<string>('backend.host');
  if (!_host) throw Error('Can not find backend host config');
  const _port = config.get<number>('backend.port');
  if (!_port) throw Error('Can not find backend port config');
  const backendUrl = `${_host}:${_port}/task/git`;

  const options: LoggerServiceOptions = {
    appName,
    hostName,
    secret,
    lokiUrl,
    backendUrl,
  };
  const service = new LoggerService(options);

  return service;
};

export const loggerService = getLogger();

export const logger = loggerService.logger;
