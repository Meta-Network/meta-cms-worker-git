import { CronJob } from 'cron';
import timer from 'timers';

import { getBackendService } from './api';
import { logger } from './logger';
import { startGitTask } from './task';

async function bootstrap(): Promise<void> {
  const http = getBackendService();
  logger.info('App started');
  await http.reportWorkerTaskStartedToBackend();

  timer
    .setTimeout(async () => {
      await startGitTask();
    }, 3000)
    .unref();

  const healthCheck = new CronJob('*/10 * * * * *', async () => {
    await http.reportWorkerTaskHealthStatusToBackend();
  });

  healthCheck.start();
}

bootstrap();
