import { checkAllowedTasks } from '@metaio/worker-common';
import { MetaWorker } from '@metaio/worker-model';

import { getBackendService } from '../api';
import { GitService } from '../git';
import { logger, loggerService } from '../logger';
import { MixedTaskConfig } from '../types';

export const startGitTask = async (): Promise<void> => {
  const allowedTasks: MetaWorker.Enums.TaskMethod[] = [
    MetaWorker.Enums.TaskMethod.GIT_CLONE_CHECKOUT,
    MetaWorker.Enums.TaskMethod.GIT_COMMIT_PUSH,
    MetaWorker.Enums.TaskMethod.GIT_INIT_PUSH,
    MetaWorker.Enums.TaskMethod.GIT_OVERWRITE_PUSH,
    MetaWorker.Enums.TaskMethod.GIT_OVERWRITE_THEME,
    MetaWorker.Enums.TaskMethod.PUBLISH_GITHUB_PAGES,
    MetaWorker.Enums.TaskMethod.GENERATE_METASPACE_CONFIG,
  ];

  const http = getBackendService();
  const taskConf = await http.getWorkerTaskFromBackend<MixedTaskConfig>();
  if (!taskConf) throw Error('Can not get task config from backend or gateway');

  const { task } = taskConf;
  const { taskId, taskMethod } = task;
  logger.info(`Task id ${taskId} start, method ${taskMethod}`);

  checkAllowedTasks(taskMethod, allowedTasks);

  const gitService = new GitService(taskConf);

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_CLONE_CHECKOUT) {
    logger.info(`Starting task cloneAndCheckoutFromRemote`);
    await gitService.cloneAndCheckoutFromRemote();
    logger.info(`Task cloneAndCheckoutFromRemote finished`);
    logger.info(`Starting task copyThemeToRepo`);
    await gitService.copyThemeToRepo();
    logger.info(`Task copyThemeToRepo finished`);
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

    logger.info(`Starting task commitAllChangesWithMessage`);
    await gitService.commitAllChangesWithMessage(repo, 'Initial Commit');
    logger.info(`Task commitAllChangesWithMessage finished`);

    logger.info(`Starting task pushLocalRepoToRemote`);
    await gitService.pushLocalRepoToRemote(repo);
    logger.info(`Task pushLocalRepoToRemote finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_OVERWRITE_PUSH) {
    logger.info(`Starting task cloneAndCheckoutFromRemote`);
    const _repo = await gitService.cloneAndCheckoutFromRemote();
    logger.info(`Task cloneAndCheckoutFromRemote finished`);

    logger.info(`Starting task replaceRepoTemplate`);
    await gitService.replaceRepoTemplate();
    logger.info(`Task replaceRepoTemplate finished`);

    logger.info(`Starting task commitAllChangesWithMessage`);
    await gitService.commitAllChangesWithMessage(_repo, 'Change template');
    logger.info(`Task commitAllChangesWithMessage finished`);

    logger.info(`Starting task pushLocalRepoToRemote`);
    await gitService.pushLocalRepoToRemote(_repo);
    logger.info(`Task pushLocalRepoToRemote finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GIT_OVERWRITE_THEME) {
    logger.info(`Starting task copyThemeToRepo`);
    await gitService.copyThemeToRepo();
    logger.info(`Task copyThemeToRepo finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.PUBLISH_GITHUB_PAGES) {
    logger.info(`Starting task publishSiteToGitHubPages`);
    await gitService.publishSiteToGitHubPages();
    logger.info(`Task publishSiteToGitHubPages finished`);
  }

  if (taskMethod === MetaWorker.Enums.TaskMethod.GENERATE_METASPACE_CONFIG) {
    logger.info(`Starting task generateMetaSpaceConfig`);
    await gitService.generateMetaSpaceConfig();
    logger.info(`Task generateMetaSpaceConfig finished`);
  }

  await http.reportWorkerTaskFinishedToBackend();
  loggerService.final('Task finished');
};
