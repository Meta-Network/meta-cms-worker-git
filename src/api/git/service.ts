import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import simpleGit, {
  InitResult,
  Options,
  SimpleGit,
  SimpleGitOptions,
  TaskOptions,
} from 'simple-git';
import { TaskConfig } from 'src/types';
import { GitServiceType } from 'src/types/enum';
import { removeControlCharacters } from 'src/utils';

import { LoggerService } from '../logger/service';

export type GitInstanceOptions = {
  baseDir: string;
};

type BuildRemoteHttpUrlWithTokenReturn = {
  originUrl: string;
  remoteUrl: string;
};

class GitInstance {
  constructor(
    private readonly logger: LoggerService,
    private readonly instanceOptions: GitInstanceOptions,
  ) {
    this.logger.setContext(GitInstance.name);
    this.logger.verbose('Creating git instance...', GitInstance.name);
    const options: Partial<SimpleGitOptions> = {
      baseDir: this.instanceOptions.baseDir,
      binary: 'git',
      maxConcurrentProcesses: 6,
    };
    this.baseDir = this.instanceOptions.baseDir;
    this.logger.verbose(
      `Git base dir set to: ${this.instanceOptions.baseDir}`,
      GitInstance.name,
    );
    this.git = simpleGit(options);
    this.logger.verbose('Git instance created', GitInstance.name);
  }

  protected readonly baseDir: string;
  protected readonly template = 'template';
  readonly git: SimpleGit;

  async cloneTemplate(url: string, branch?: string): Promise<string> {
    const options: TaskOptions<Options> = ['--bare'];
    if (branch) {
      options.push(`--branch=${branch}`);
    }
    this.logger.verbose(
      `Cloning template from ${url}, path: ${this.baseDir}/${
        this.template
      }, branch: ${branch || 'not set'}`,
      GitInstance.name,
    );
    return await this.git.clone(url, this.template, options);
  }

  async initRepoFromTemplate(name: string): Promise<InitResult> {
    this.logger.verbose(
      `Initializing repo from template: ${this.baseDir}/${this.template}`,
      GitInstance.name,
    );
    return await this.git.init([`--template=./${this.template}`, name]);
  }
}

@Injectable()
export class GitService {
  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}

  protected instance: GitInstance;

  protected async buildRemoteHttpUrl(
    type: GitServiceType,
    uname: string,
    rname: string,
  ): Promise<string> {
    if (type === GitServiceType.GITHUB) {
      const remoteUrl = `https://github.com/${uname}/${rname}.git`;
      this.logger.verbose(`Git remote url is: ${remoteUrl}`, GitService.name);
      return remoteUrl;
    }
    // TODO: Unsupport type
  }

  protected async buildRemoteHttpUrlWithToken(
    type: GitServiceType,
    token: string,
    uname: string,
    rname: string,
  ): Promise<BuildRemoteHttpUrlWithTokenReturn> {
    if (type === GitServiceType.GITHUB) {
      const originUrl = await this.buildRemoteHttpUrl(type, uname, rname);
      const pass = 'x-oauth-basic';
      const result = {
        originUrl,
        remoteUrl: originUrl.replace(
          'github.com',
          `${token}:${pass}@github.com`,
        ),
      };
      return result;
    }
    // TODO: Unsupport type
  }

  async init(): Promise<void> {
    try {
      this.logger.setContext(GitService.name);
      const dirName = this.config.get<string>('git.baseDirName');
      this.logger.verbose(`Git base dir name is: ${dirName}`, GitService.name);
      const baseDir = await fs.mkdtemp(`${path.join(os.tmpdir(), dirName)}-`);
      this.logger.verbose(
        `Temporary directory is created, path: ${baseDir}`,
        GitService.name,
      );
      this.instance = new GitInstance(this.logger, { baseDir: baseDir });
    } catch (error) {
      this.logger.error('Create git base dir faild:', error);
    }
  }

  async createRepoFromTemplate(config: TaskConfig): Promise<void> {
    try {
      const {
        gitType,
        gitUsername,
        gitReponame,
        gitToken,
        gitBranchName,
        templateRepoUrl,
        templateBranchName,
      } = config;
      // Clone template
      this.logger.log(`Cloning template...`, GitService.name);
      await this.instance.cloneTemplate(templateRepoUrl, templateBranchName);
      this.logger.log('Clone template successful', GitService.name);
      // Initialize repo
      this.logger.log(`Initializing repo...`, GitService.name);
      const init = await this.instance.initRepoFromTemplate(gitReponame);
      const { path: gitPath, gitDir } = init;
      this.logger.verbose(
        `Initialized repo ${gitReponame} gitPath: ${gitPath}, gitDir: ${gitDir}`,
        GitService.name,
      );
      this.logger.log(
        `Initialize repo ${gitReponame} successful`,
        GitService.name,
      );
      // Join repo
      const localGit = simpleGit(`${gitPath}/${gitReponame}`);
      // Restore files
      const reset = await localGit.reset(['--hard']);
      this.logger.verbose(`Git reset ${reset}`, GitService.name);
      // Remove original remote
      const _remote = await localGit.remote(['show']);
      this.logger.verbose(
        `Repo ${gitReponame} has remote ${_remote}`,
        GitService.name,
      );
      if (typeof _remote !== 'string')
        throw new ReferenceError(
          `Repo ${gitReponame} does not have any remote`,
        );
      const oldRemote = removeControlCharacters(_remote);
      await localGit.removeRemote(removeControlCharacters(oldRemote));
      this.logger.verbose(
        `Remove remote ${oldRemote} successful`,
        GitService.name,
      );
      // Add new remote
      const { remoteUrl, originUrl } = await this.buildRemoteHttpUrlWithToken(
        gitType,
        gitToken,
        gitUsername,
        gitReponame,
      );
      await localGit.addRemote('origin', remoteUrl);
      this.logger.verbose(`Add new remote, name: origin`, GitService.name);
      // Change branch name
      const branch = await localGit.checkout(['-b', gitBranchName]);
      this.logger.verbose(
        `Create and checkout with branch name: ${gitBranchName}, output: ${branch}`,
        GitService.name,
      );
      // Push to remote
      this.logger.log(`Pushing to repo: ${originUrl}...`, GitService.name);
      const push = await localGit.push('origin', gitBranchName);
      this.logger.verbose(
        `Push repo ${gitReponame} result: localRef: ${
          push.ref?.local
        }, ${push.pushed.map((i) => Object.entries(i))}`,
        GitService.name,
        { original: push },
      );
      this.logger.log(
        `Push repo ${gitReponame} to remote successful`,
        GitService.name,
      );
    } catch (error) {
      this.logger.error('Create repo from template faild:', error);
    }
  }
}
