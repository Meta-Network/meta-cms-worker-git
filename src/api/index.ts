import {
  BackendTaskService,
  BackendTaskServiceOptions,
} from '@metaio/worker-common';

import { config } from '../configs';
import { logger } from '../logger';

export const getBackendService = (): BackendTaskService => {
  const secret = config.get<string>('WORKER_SECRET');
  if (!secret) throw Error('Can not find WORKER_SECRET env');
  const hostName = config.get<string>('HOSTNAME');
  if (!hostName) throw Error('Can not find HOSTNAME env');
  const _host = config.get<string>('backend.host');
  if (!_host) throw Error('Can not find backend host config');
  const _port = config.get<number>('backend.port');
  if (!_port) throw Error('Can not find backend port config');

  const backendUrl = `${_host}:${_port}/task/git`;

  const options: BackendTaskServiceOptions = {
    hostName,
    secret,
    backendUrl,
  };

  return new BackendTaskService(logger, options);
};
