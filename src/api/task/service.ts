import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Timeout } from '@nestjs/schedule';
import { Microservice } from 'src/constants';
import { TaskConfig } from 'src/types';
import { GitServiceType, TaskMethod } from 'src/types/enum';

import { GitService } from '../git/service';
import { LoggerService } from '../logger/service';

@Injectable()
export class TasksService {
  constructor(
    private readonly logger: LoggerService,
    private readonly service: GitService,
    @Inject(Microservice.CMS_BACKEND) private readonly client: ClientProxy,
  ) {
    this.logger.setContext(TasksService.name);
  }

  @Timeout(5000)
  async startGitTask(): Promise<void> {
    this.logger.verbose('Initializing git service...', TasksService.name);
    await this.service.init();

    this.logger.log(
      'Getting new Git task from CMS backend...',
      TasksService.name,
    );
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

    const { taskMethod } = taskConf;
    this.logger.verbose(`Task method is: ${taskMethod}`, TasksService.name);

    if (taskMethod === TaskMethod.CREATE_REPO_FROM_TEMPLATE) {
      this.logger.verbose(
        `Starting task createRepoFromTemplate...`,
        TasksService.name,
      );
      await this.service.createRepoFromTemplate(taskConf);
      this.logger.verbose(
        `Task createRepoFromTemplate finished`,
        TasksService.name,
      );
      // TODO: Report taskId finish
      process.exit(0);
    }
  }
}
