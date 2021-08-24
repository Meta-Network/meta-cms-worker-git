import superagent, { SuperAgentStatic } from 'superagent';

import { config } from '../configs';
import { TaskConfig } from '../types';

export class HttpRequestService {
  constructor() {
    this.client = superagent;

    const _sec = config.get<string>('WORKER_GIT_SECRET');
    if (!_sec) throw Error('Can not find WORKER_GIT_SECRET env');
    this.secret = _sec;

    const _host = config.get<string>('backend.host');
    const _port = config.get<number>('backend.port');
    this.apiUrl = `${_host}:${_port}`;
  }

  private readonly client: SuperAgentStatic;
  private readonly apiUrl: string;
  private readonly secret: string;

  async getWorkerTaskFromBackend(): Promise<TaskConfig> {
    const _res = await this.client
      .get(`${this.apiUrl}/task`)
      .set(
        'Authorization',
        `Basic ${Buffer.from(this.secret).toString('base64')}`,
      );

    const _data = _res?.body?.data;
    if (!_data) throw Error('Can not get task config from backend');
    return _res.body.data as TaskConfig;
  }
}
