import { GitService } from 'src/git';
import { logger, loggerService } from 'src/logger';
import { TaskConfig } from 'src/types';
import { GitServiceType, TaskMethod } from 'src/types/enum';

export const startGitTask = async (): Promise<void> => {
  logger.info('Getting new Git task from gateway');
  // TODO: Get task

  const taskConf: TaskConfig = {
    taskId: '123e4567-e89b-12d3-a456-426614174000',
    taskMethod: TaskMethod.CREATE_REPO_FROM_TEMPLATE,
    username: 'Garfield550',
    title: 'Test Site',
    configId: 1,
    templateName: 'Cactus',
    templateRepoUrl: 'https://github.com/whyouare111/hexo-theme-cactus.git',
    templateBranchName: 'metaspace',
    gitToken: 'gho_',
    gitType: GitServiceType.GITHUB,
    gitUsername: 'Garfield550',
    gitReponame: 'my-awesome-site',
    gitBranchName: 'meow',
  };
  const { taskId, taskMethod } = taskConf;
  logger.info(`Task id ${taskId} start, method ${taskMethod}`);

  const gitService = new GitService(taskConf);

  if (taskMethod === TaskMethod.CREATE_REPO_FROM_TEMPLATE) {
    logger.info(`Starting task createRepoFromTemplate`);
    const repo = await gitService.createRepoFromTemplate();
    await gitService.pushLocalRepoToRemote(repo);
    logger.info(`Task createRepoFromTemplate finished`);
    // TODO: Report taskId finish
    loggerService.final(null, 'Task finished');
  }
};
