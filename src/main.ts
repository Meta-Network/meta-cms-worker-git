import cron from 'cron';
import timer from 'timers';

import { logger, loggerService } from './logger';
import { startGitTask } from './task';

async function bootstrap(): Promise<void> {
  logger.info('App started');

  const gitTask = timer
    .setTimeout(async () => {
      await startGitTask();
    }, 3000)
    .unref();

  const healthCheck = new cron.CronJob('*/60 * * * * *', async () => {
    logger.info('Health check');
  });

  healthCheck.start();

  process.on('uncaughtException', (error) => {
    loggerService.final(error);
    timer.clearTimeout(gitTask);
  });

  process.on('unhandledRejection', (reason) => {
    loggerService.final(reason as Error, 'unhandledRejection');
    timer.clearTimeout(gitTask);
  });
}

bootstrap();
