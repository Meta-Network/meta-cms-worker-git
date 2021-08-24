import superagent, { SuperAgentStatic } from 'superagent';

import { config } from '../configs';
import { logger } from '../logger';
import { TaskConfig } from '../types';

export class HttpRequestService {
  constructor() {
    this.client = superagent;

    const _sec = config.get<string>('WORKER_SECRET');
    if (!_sec) throw Error('Can not find WORKER_SECRET env');
    this.secret = _sec;
    this.authInfo = `Basic ${Buffer.from(this.secret).toString('base64')}`;

    const _host = config.get<string>('backend.host');
    if (!_host) throw Error('Can not find backend host config');
    const _port = config.get<number>('backend.port');
    if (!_port) throw Error('Can not find backend port config');
    this.baseUrl = `${_host}:${_port}`;

    const _name = config.get<string>('HOSTNAME');
    if (!_name) throw Error('Can not find HOSTNAME env');
    this.hostName = _name;

    this.apiUrl = `${this.baseUrl}/task/git/${this.hostName}`;
  }

  private readonly client: SuperAgentStatic;
  private readonly secret: string;
  private readonly authInfo: string;
  private readonly baseUrl: string;
  private readonly hostName: string;
  private readonly apiUrl: string;

  async getWorkerTaskFromBackend(): Promise<TaskConfig> {
    logger.info('Getting new Git task from backend');

    const _res = await this.client
      .get(this.apiUrl)
      .set('Authorization', this.authInfo);

    const _data: TaskConfig = _res?.body?.data;
    if (!_data) throw Error('Can not get task config from backend');
    return _data;
  }

  async reportWorkerTaskStartedToBackend(): Promise<void> {
    logger.info('Reporting worker task started to backend');

    const _res = await this.client
      .patch(this.apiUrl)
      .send({ reason: 'STARTED', timestamp: Date.now() })
      .set('Authorization', this.authInfo);

    logger.info(`Report worker task started to backend ${_res.statusCode}`);
  }

  async reportWorkerTaskFinishedToBackend(): Promise<void> {
    logger.info('Reporting worker task finished to backend');

    const _res = await this.client
      .patch(this.apiUrl)
      .send({ reason: 'FINISHED', timestamp: Date.now() })
      .set('Authorization', this.authInfo);

    logger.info(`Report worker task finished to backend ${_res.statusCode}`);
  }

  async reportWorkerTaskErroredToBackend(error: Error): Promise<void> {
    logger.info('Reporting worker task errored to backend');

    const _res = await this.client
      .patch(this.apiUrl)
      .send({ reason: 'ERRORED', timestamp: Date.now(), data: error })
      .set('Authorization', this.authInfo);

    logger.info(`Report worker task errored to backend ${_res.statusCode}`);
  }

  async reportWorkerTaskHealthStatusToBackend(): Promise<void> {
    logger.info('Reporting worker task health status to backend');

    const _res = await this.client
      .patch(this.apiUrl)
      .send({ reason: 'HEALTH_CHECK', timestamp: Date.now() })
      .set('Authorization', this.authInfo);

    logger.info(
      `Report worker task health status to backend ${_res.statusCode}`,
    );
  }
}
