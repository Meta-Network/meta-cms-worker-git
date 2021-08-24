import cron from 'cron';
import timer from 'timers';

import { HttpRequestService } from './api';
import { logger } from './logger';
import { startGitTask } from './task';

async function bootstrap(): Promise<void> {
  const http = new HttpRequestService();
  logger.info('App started');
  await http.reportWorkerTaskStartedToBackend();

  timer
    .setTimeout(async () => {
      await startGitTask();
    }, 3000)
    .unref();

  const healthCheck = new cron.CronJob('*/10 * * * * *', async () => {
    logger.info('Health check');
    await http.reportWorkerTaskHealthStatusToBackend();
  });

  healthCheck.start();
}

bootstrap();
