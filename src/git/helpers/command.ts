import execa from 'execa';
import process from 'process';

import { logger } from '../../logger';
import { LogContext } from '../../types';

export interface IGitCommandHelper {
  config(configKey: string, configValue: string, add?: boolean): Promise<void>;
  init(branchName?: string): Promise<void>;
}

export async function createCommandHelper(
  workingDirectory: string,
): Promise<IGitCommandHelper> {
  return await GitCommandHelper.createCommandManager(workingDirectory);
}

class GitCommandHelper implements IGitCommandHelper {
  private constructor() {
    this.context = {
      context: this.constructor.name,
    };
  }

  private readonly context: LogContext;
  private gitEnv = {
    GIT_TERMINAL_PROMPT: '0', // Disable git prompt
    GCM_INTERACTIVE: 'Never', // Disable prompting for git credential manager
  };
  private workingDirectory = '';

  private async initializeCommandManager(
    workingDirectory: string,
  ): Promise<void> {
    this.workingDirectory = workingDirectory;
    logger.debug(
      `Git working directory is ${this.workingDirectory}`,
      this.context,
    );

    logger.verbose('Getting git version', this.context);
    const gitOutput = await this.execGit(['--version']);
    const gitVersion = gitOutput.stdout.trim().match(/\d+\.\d+(\.\d+)?/);
    if (gitVersion) logger.debug(`Git version: ${gitVersion[0]}`, this.context);

    const gitHttpUserAgent = `git/${gitVersion} (meta-cms-worker-git)`;
    logger.debug(`Set git useragent to: ${gitHttpUserAgent}`, this.context);
    this.gitEnv['GIT_HTTP_USER_AGENT'] = gitHttpUserAgent;
  }

  private async execGit(
    args: string[],
  ): Promise<execa.ExecaReturnValue<string>> {
    const env = Object.assign({}, process.env, this.gitEnv);

    const options: execa.Options = {
      cwd: this.workingDirectory,
      env,
    };

    logger.verbose(`Exec git command: git ${args.join(' ')}`, this.context);

    return await execa('git', args, options);
  }

  public static async createCommandManager(
    workingDirectory: string,
  ): Promise<GitCommandHelper> {
    const result = new GitCommandHelper();
    await result.initializeCommandManager(workingDirectory);
    return result;
  }

  public async config(
    configKey: string,
    configValue: string,
    add?: boolean,
  ): Promise<void> {
    const args: string[] = ['config', '--local'];
    if (add) {
      args.push('--add');
    }
    args.push(...[configKey, configValue]);
    await this.execGit(args);
  }

  public async init(branchName?: string): Promise<void> {
    const args: string[] = ['init'];
    if (branchName) {
      args.push(`--initial-branch=${branchName}`);
    }
    args.push(this.workingDirectory);
    await this.execGit(args);
  }
}
