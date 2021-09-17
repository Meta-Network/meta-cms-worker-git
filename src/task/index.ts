import { MetaWorker } from '@metaio/worker-model';

import { getBackendService } from '../api';
import { GitService } from '../git';
import { logger, loggerService } from '../logger';
import { MixedTaskConfig } from '../types';

export const startGitTask = async (): Promise<void> => {
  const http = getBackendService();
  const taskConf = await http.getWorkerTaskFromBackend<MixedTaskConfig>();
  if (!taskConf) throw Error('Can not get task config from backend or gateway');

  const { task } = taskConf;
  const { taskId, taskMethod } = task;
  logger.info(`Task id ${taskId} start, method ${taskMethod}`);

  const gitService = new GitService(taskConf);

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_CLONE_CHECKOUT) {
    logger.info(`Starting task cloneAndCheckoutFromRemote`);
    await gitService.cloneAndCheckoutFromRemote();
    logger.info(`Task cloneAndCheckoutFromRemote finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_COMMIT_PUSH) {
    logger.info(`Starting task openRepoFromLocal`);
    const repo = await gitService.openRepoFromLocal();
    logger.info(`Task openRepoFromLocal finished`);

    logger.info(`Starting task commitAllChangesWithMessage`);
    await gitService.commitAllChangesWithMessage(repo, 'Update');
    logger.info(`Task commitAllChangesWithMessage finished`);

    logger.info(`Starting task pushLocalRepoToRemote`);
    await gitService.pushLocalRepoToRemote(repo);
    logger.info(`Task pushLocalRepoToRemote finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_INIT_PUSH) {
    logger.info(`Starting task createRepoFromTemplate`);
    const repo = await gitService.createRepoFromTemplate();
    logger.info(`Task createRepoFromTemplate finished`);

    logger.info(`Starting task pushLocalRepoToRemote`);
    await gitService.pushLocalRepoToRemote(repo);
    logger.info(`Task pushLocalRepoToRemote finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_OVERWRITE_PUSH) {
    // TODO: Clone repo and overwrite temlpate files
  }

  await http.reportWorkerTaskFinishedToBackend();
  loggerService.final('Task finished');
};
