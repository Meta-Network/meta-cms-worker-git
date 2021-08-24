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
    const _port = config.get<number>('backend.port');
    this.apiUrl = `${_host}:${_port}`;

    const _name = config.get<string>('HOSTNAME');
    if (!_name) throw Error('Can not find HOSTNAME env');
  }

  private readonly client: SuperAgentStatic;
  private readonly secret: string;
  private readonly authInfo: string;
  private readonly apiUrl: string;
  private readonly hostName: string;

  async getWorkerTaskFromBackend(): Promise<TaskConfig> {
    const _url = `${this.apiUrl}/task/${this.hostName}`;

    const _res = await this.client
      .get(_url)
      .set('Authorization', this.authInfo);

    const _data: TaskConfig = _res?.body?.data;
    if (!_data) throw Error('Can not get task config from backend');
    return _data;
  }

  async reportWorkerTaskStartedToBackend(): Promise<void> {
    const _url = `${this.apiUrl}/task/${this.hostName}`;

    const _res = await this.client
      .patch(_url)
      .send({ reason: 'STARTED', timestamp: Date.now() })
      .set('Authorization', this.authInfo);

    logger.info(`Report worker task started to backend ${_res.statusCode}`);
  }

  async reportWorkerTaskHealthStatusToBackend(): Promise<void> {
    const _url = `${this.apiUrl}/task/${this.hostName}`;

    const _res = await this.client
      .patch(_url)
      .send({ reason: 'STARTED', timestamp: Date.now() })
      .set('Authorization', this.authInfo);

    logger.info(
      `Report worker task health status to backend ${_res.statusCode}`,
    );
  }
}
