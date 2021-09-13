import { MetaWorker } from '@metaio/worker-model';

import { HttpRequestService } from '../api';
import { GitService } from '../git';
import { logger, loggerService } from '../logger';

export const startGitTask = async (): Promise<void> => {
  const http = new HttpRequestService();
  const taskConf = await http.getWorkerTaskFromBackend();
  if (!taskConf) throw Error('Can not get task config from backend or gateway');

  const { taskId, taskMethod } = taskConf;
  logger.info(`Task id ${taskId} start, method ${taskMethod}`);

  const gitService = new GitService(taskConf);

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_INIT_PUSH) {
    logger.info(`Starting task createRepoFromTemplate`);
    const repo = await gitService.createRepoFromTemplate();
    await gitService.pushLocalRepoToRemote(repo);
    logger.info(`Task createRepoFromTemplate finished`);
    await http.reportWorkerTaskFinishedToBackend();
    loggerService.final('Task finished');
  }
};
