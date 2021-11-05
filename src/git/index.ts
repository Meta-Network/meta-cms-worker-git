import { isDeployTask, isPublishTask } from '@metaio/worker-common';
import { MetaWorker } from '@metaio/worker-model';
import fs from 'fs';
import fsp from 'fs/promises';
import { copy } from 'fs-extra';
import Git, { Repository } from 'nodegit';
import os from 'os';
import path from 'path';
import yaml from 'yaml';

import { logger } from '../logger';
import {
  BuildBasicInfoFromTemplateUrl,
  BuildRemoteHttpUrlWithTokenReturn,
  DownloadRepositoryArchiveReturn,
  GitAuthor,
  LogContext,
  MixedTaskConfig,
} from '../types';
import { createAuthHelper } from './helpers/auth';
import { createCommandHelper, IGitCommandHelper } from './helpers/command';
import { GiteeService } from './services/gitee';
import { GitHubService } from './services/github';
import { ZipArchiveService } from './zip';

type SpecificFrameworkInfo = {
  themeDirName: string;
  sourceDirName: string;
};

export class GitService {
  constructor(private readonly taskConfig: MixedTaskConfig) {
    this.context = { context: GitService.name };

    const {
      task: { taskWorkspace },
    } = this.taskConfig;
    logger.info(`Task workspace is ${taskWorkspace}`, this.context);

    const baseDir = path.join(os.tmpdir(), taskWorkspace);
    fs.mkdirSync(baseDir, { recursive: true });
    logger.info(
      `Git temporary directory is created, path: ${baseDir}`,
      this.context,
    );

    this.baseDir = baseDir;

    this.gitAuthor = { name: 'Meta Network', email: 'noreply@meta.io' };
  }

  private readonly context: LogContext;
  /** A path start with os temp directory, e.g: /tmp/workspace */
  private readonly baseDir: string;
  private readonly gitAuthor: GitAuthor;

  private async buildRemoteGitUrlWithToken(
    type: MetaWorker.Enums.GitServiceType,
    token: string,
    uname: string,
    rname: string,
  ): Promise<BuildRemoteHttpUrlWithTokenReturn> {
    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      return await GitHubService.buildRemoteGitUrlWithToken(
        token,
        uname,
        rname,
      );
    }
    if (type === MetaWorker.Enums.GitServiceType.GITEE) {
      return await GiteeService.buildRemoteGitUrlWithToken(token, uname, rname);
    }
    throw new Error(`Unsupport type ${type}`);
  }

  private async buildBasicInfoFromGitUrl(
    type: MetaWorker.Enums.GitServiceType,
    url: string,
  ): Promise<BuildBasicInfoFromTemplateUrl> {
    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      return await GitHubService.buildBasicInfoFromGitUrl(url);
    }
    if (type === MetaWorker.Enums.GitServiceType.GITEE) {
      return await GiteeService.buildBasicInfoFromGitUrl(url);
    }
    throw new Error(`Unsupport type ${type}`);
  }

  private async downloadArchiveFromGitUrl(
    type: MetaWorker.Enums.GitServiceType,
    url: string,
    branch?: string,
    file?: string,
  ): Promise<DownloadRepositoryArchiveReturn> {
    const { owner, repo } = await this.buildBasicInfoFromGitUrl(type, url);

    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      const github = new GitHubService(this.baseDir);
      return await github.downloadRepositoryArchive(owner, repo, branch, file);
    }
    throw new Error(`Unsupport type ${type}`);
  }

  private async decompressRepositoryArchive(
    archivePath: string,
  ): Promise<string> {
    const output = path.join(this.baseDir, 'temp');
    await this.removeIfPathExists(output);

    const zip = new ZipArchiveService();

    return await zip.extractAllFiles(archivePath, output);
  }

  private async copyDecompressedFilesIntoRepo(
    tPath: string,
    rPath: string,
    findStr?: string,
  ): Promise<void> {
    let _cPath = tPath.replace(path.extname(tPath), '');
    logger.info(`Decompressed directory is ${_cPath}`, this.context);

    if (findStr) {
      const files = await fsp.readdir(_cPath, { withFileTypes: true });
      const dirs = files
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);
      const findDir = dirs.find((name) => name.includes(findStr));
      if (findDir) _cPath = path.join(_cPath, findDir);
    }

    logger.info(
      `Copy decompressed files from ${_cPath} to ${rPath}`,
      this.context,
    );
    await copy(_cPath, rPath, { recursive: true, overwrite: true });
  }

  private async getRemoteUrl(gitInfo: MetaWorker.Info.Git): Promise<string> {
    const { serviceType, username, reponame } = gitInfo;
    if (serviceType === MetaWorker.Enums.GitServiceType.GITHUB) {
      return GitHubService.getFetchUrl(username, reponame);
    }
    if (serviceType === MetaWorker.Enums.GitServiceType.GITEE) {
      return GiteeService.getFetchUrl(username, reponame);
    }
    throw new Error(`Unsupport type ${serviceType}`);
  }

  private async initializeRepository(
    gitInfo: MetaWorker.Info.Git,
  ): Promise<IGitCommandHelper> {
    const { reponame, branchName } = gitInfo;
    const repoPath = path.join(this.baseDir, reponame);
    // Create repo dir
    await fsp.mkdir(repoPath, { recursive: true });
    logger.info(
      `Initialize git repository to ${repoPath}, branch ${branchName}`,
      this.context,
    );
    const git = await createCommandHelper(repoPath);
    await git.init(branchName);
    return git;
  }

  private async openRepository(
    gitInfo: MetaWorker.Info.Git,
  ): Promise<IGitCommandHelper> {
    const { reponame } = gitInfo;
    const repoPath = path.join(this.baseDir, reponame);
    if (!fs.existsSync(repoPath)) {
      throw new Error(
        `Can not open git repository, path ${repoPath} not exists.`,
      );
    }
    logger.info(`Open git repository from ${repoPath}`, this.context);
    return await createCommandHelper(repoPath);
  }

  private async addAllChanges(git: IGitCommandHelper): Promise<void> {
    await git.addAll();
  }

  private async commitWithMessage(
    git: IGitCommandHelper,
    msg: string,
  ): Promise<void> {
    await git.commit(msg, this.gitAuthor);
  }

  private async setRepositoryRemote(
    git: IGitCommandHelper,
    gitInfo: MetaWorker.Info.Git,
    remote = 'origin',
  ): Promise<void> {
    logger.info(`Lookup repository remote`, this.context);
    const remotes = await git.remoteShow();
    if (remotes.includes(remote)) {
      logger.info(`Previous remote '${remote}' found, remove it`, this.context);
      await git.remoteRemove(remote);
    }
    const remoteUrl = await this.getRemoteUrl(gitInfo);
    logger.info(
      `Add repository remote '${remote}', url: ${remoteUrl}`,
      this.context,
    );
    await git.remoteAdd(remote, remoteUrl);
  }

  private async removeIfPathExists(path: string): Promise<void> {
    const isExists = fs.existsSync(path);
    if (isExists) {
      logger.info(`Path ${path} exists, remove it.`, this.context);
      fs.rmSync(path, { recursive: true });
    }
  }

  private async getSpecificFrameworkInfoByTemplateType(
    type: MetaWorker.Enums.TemplateType,
  ): Promise<SpecificFrameworkInfo> {
    if (type === MetaWorker.Enums.TemplateType.HEXO) {
      return {
        themeDirName: 'themes',
        sourceDirName: 'source',
      };
    }
    throw new Error(
      `getSpecificFrameworkInfoByTemplateType: Unsupported type ${type}`,
    );
  }

  private async createMetaSpaceConfigFile(
    config: MetaWorker.Configs.DeployConfig,
    repoPath: string,
  ): Promise<void> {
    const fileName = 'meta-space-config.yml';
    const { user, site, theme, gateway, metadata } = config;
    const metaSpaceConfig: MetaWorker.Configs.MetaSpaceConfig = {
      user,
      site,
      theme,
      gateway,
      metadata,
    };
    const filePath = path.join(repoPath, fileName);
    const yamlStr = yaml.stringify(metaSpaceConfig);
    const data = new Uint8Array(Buffer.from(yamlStr));
    await fsp.writeFile(filePath, data, { encoding: 'utf8' });
    logger.info(
      `Successful create ${fileName} file, path: ${filePath}`,
      this.context,
    );
  }

  // For publisher
  private async createNoJekyllFile(
    workDir: string,
    disableNoJekyll?: boolean,
  ): Promise<void> {
    if (disableNoJekyll) return;
    await fsp.mkdir(workDir, { recursive: true });
    const filePath = path.join(workDir, '.nojekyll');
    const isExists = fs.existsSync(filePath);
    if (isExists) return;
    await fsp.writeFile(filePath, '\n');
    logger.info(
      `Successful create .nojekyll file, path: ${filePath}`,
      this.context,
    );
  }
  // For publisher
  private async createCNameFile(
    workDir: string,
    content: string,
  ): Promise<void> {
    if (!content) return;
    await fsp.mkdir(workDir, { recursive: true });
    const filePath = path.join(workDir, 'CNAME');
    const isExists = fs.existsSync(filePath);
    if (isExists) {
      logger.info(`CNAME file already exists`, this.context);
      return;
    }
    await fsp.writeFile(filePath, `${content}\n`);
    logger.info(
      `Successful create CNAME file, path: ${filePath}`,
      this.context,
    );
  }

  public async createRepoFromTemplate(): Promise<IGitCommandHelper> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);
    const {
      git: { storage },
      template,
    } = this.taskConfig;
    const { reponame, serviceType } = storage;

    const git = await this.initializeRepository(storage);

    const { templateRepoUrl, templateBranchName } = template;
    logger.info(
      `Download template zip archive from ${templateRepoUrl}`,
      this.context,
    );
    const _archive = await this.downloadArchiveFromGitUrl(
      serviceType,
      templateRepoUrl,
      templateBranchName,
    );
    const { filePath, findStr } = _archive;
    logger.info(`Decompress template archive ${filePath}`, this.context);
    const _template = await this.decompressRepositoryArchive(filePath);

    const repoPath = path.join(this.baseDir, reponame);
    await this.copyDecompressedFilesIntoRepo(_template, repoPath, findStr);
    await this.createMetaSpaceConfigFile(this.taskConfig, repoPath);

    return git;
  }

  async replaceRepoTemplate(): Promise<void> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);

    const {
      git: { storage },
      template,
    } = this.taskConfig;
    const { serviceType, reponame } = storage;
    const { templateRepoUrl, templateBranchName, templateType } = template;
    const repoPath = path.join(this.baseDir, reponame);

    // Backup source folder
    const _frameworkInfo = await this.getSpecificFrameworkInfoByTemplateType(
      templateType,
    );
    const sourceName = _frameworkInfo.sourceDirName;
    const sourcePath = path.join(repoPath, sourceName);
    const backupPath = path.join(this.baseDir, 'backup', sourceName);
    logger.info(`Backup ${sourcePath} to ${backupPath}`, this.context);
    await copy(sourcePath, backupPath, {
      recursive: true,
      overwrite: true,
    });

    // Remove all files except .git folder
    const files = await fsp.readdir(repoPath);
    files.forEach((name) => {
      if (name !== '.git') {
        const removePath = path.join(repoPath, name);
        logger.info(`Remove path ${removePath}`, this.context);
        fs.rmSync(removePath, { recursive: true });
      }
    });

    // Download new template
    logger.info(
      `Download template zip archive from ${templateRepoUrl}`,
      this.context,
    );
    const _archive = await this.downloadArchiveFromGitUrl(
      serviceType,
      templateRepoUrl,
      templateBranchName,
    );

    // Decompress and copy files
    const { filePath, findStr } = _archive;
    logger.info(`Decompress template archive ${filePath}`, this.context);
    const _template = await this.decompressRepositoryArchive(filePath);
    await this.copyDecompressedFilesIntoRepo(_template, repoPath, findStr);

    // Remove template source folder
    await this.removeIfPathExists(sourcePath);

    // Restore original source folder
    logger.info(
      `Restore backup from ${backupPath} to ${sourcePath}`,
      this.context,
    );
    await copy(backupPath, sourcePath, {
      recursive: true,
      overwrite: true,
    });

    // Create meta space config file
    await this.createMetaSpaceConfigFile(this.taskConfig, repoPath);
  }

  async copyThemeToRepo(): Promise<void> {
    if (!isDeployTask(this.taskConfig)) {
      logger.info(`Task config is not for deploy, skip.`);
      return;
    }
    const {
      theme,
      git: { storage },
    } = this.taskConfig;
    const { serviceType, reponame } = storage;
    const { themeRepo, themeBranch, themeName, themeType, isPackage } = theme;

    if (isPackage) {
      logger.info(`This theme has npm package, skip.`);
      return;
    }

    // Use download instead of Git clone cause `libgit2` not support clone depth
    // see https://github.com/libgit2/libgit2/issues/3058
    logger.info(`Download theme zip archive from ${themeRepo}`, this.context);
    const _archive = await this.downloadArchiveFromGitUrl(
      serviceType,
      themeRepo,
      themeBranch,
      'theme.zip',
    );

    const { filePath, findStr } = _archive;
    logger.info(`Decompress theme archive ${filePath}`, this.context);
    const _theme = await this.decompressRepositoryArchive(filePath);

    const _frameworkInfo = await this.getSpecificFrameworkInfoByTemplateType(
      themeType,
    );
    const _themeDirName = _frameworkInfo.themeDirName;

    const _themePath = path.join(
      this.baseDir,
      reponame,
      _themeDirName,
      themeName,
    );
    logger.info(`Create theme directory ${_themePath}`, this.context);
    await fsp.mkdir(_themePath, { recursive: true });

    logger.info(`Copy theme files to ${_themePath}`, this.context);
    await this.copyDecompressedFilesIntoRepo(_theme, _themePath, findStr);
  }

  async cloneAndCheckoutFromRemote(branch?: string): Promise<Repository> {
    const {
      git: { storage },
    } = this.taskConfig;
    const { serviceType, token, username, reponame, branchName } = storage;
    const repoPath = path.join(this.baseDir, reponame);
    await this.removeIfPathExists(repoPath);
    const _remoteUrls = await this.buildRemoteGitUrlWithToken(
      serviceType,
      token,
      username,
      reponame,
    );
    const { remoteUrl } = _remoteUrls;
    logger.info(`Clone repo ${reponame} to ${repoPath}`, this.context);
    if (!branch) branch = branchName;
    const _localRepo = await Git.Clone.clone(remoteUrl, repoPath, {
      checkoutBranch: branch,
    });
    return _localRepo;
  }

  async openRepoFromLocal(branch?: string): Promise<Repository> {
    const {
      git: { storage },
    } = this.taskConfig;
    const { reponame, branchName } = storage;
    const repoPath = path.join(this.baseDir, reponame);
    logger.info(`Open repo ${reponame} from ${repoPath}`, this.context);
    const _localRepo = await Git.Repository.open(repoPath);
    const _branch = await _localRepo.getCurrentBranch();
    const _branchName = _branch.shorthand();
    logger.info(`Current branch is ${_branchName}`, this.context);
    if (!branch) branch = branchName;
    if (branch !== _branchName) {
      logger.info(`Checkout branch ${branch}`, this.context);
      await _localRepo.checkoutBranch(branch);
      logger.info(`Successful checkout branch ${branch}`, this.context);
    }
    return _localRepo;
  }

  public async commitAllChangesWithMessage(
    git: IGitCommandHelper,
    msg: string,
  ): Promise<void> {
    await this.addAllChanges(git);
    await this.commitWithMessage(git, msg);
    logger.info(`Commit all changes with message ${msg}`, this.context);
  }

  public async pushLocalRepoToRemote(
    git: IGitCommandHelper,
    info: MetaWorker.Info.Git,
    branch?: string,
    force?: boolean,
  ): Promise<void> {
    const auth = createAuthHelper(git, info);
    await auth.configureAuth();

    await this.setRepositoryRemote(git, info);

    const { branchName } = info;
    if (!branch) branch = branchName;

    logger.info(
      `Pushing local repository to remote 'origin', branch ${branch}`,
      this.context,
    );
    await git.push('origin', branch, force);

    await auth.removeAuth();
  }

  public async publishSiteToGitHubPages(): Promise<void> {
    if (!isPublishTask(this.taskConfig))
      throw new Error('Task config is not for publish site');
    const {
      publish,
      site,
      git: { publisher, storage },
    } = this.taskConfig;
    const { publishDir, publishBranch } = publish;
    const workDir = path.join(this.baseDir, storage.reponame, publishDir);
    await this.createNoJekyllFile(workDir);
    await this.createCNameFile(workDir, site.domain);

    const publishGitInfo: MetaWorker.Info.Git = {
      ...publisher,
      reponame: path.join(storage.reponame, publishDir), // storageReponame/publishDir
      branchName: publishBranch,
    };
    const git = await this.initializeRepository(publishGitInfo);
    await this.commitAllChangesWithMessage(git, `Publish ${Date.now()}`);
    // Use force push
    await this.pushLocalRepoToRemote(git, publisher, publishBranch, true);
  }

  public async generateMetaSpaceConfig(): Promise<void> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);
    const {
      git: { storage },
    } = this.taskConfig;
    const repoPath = path.join(this.baseDir, storage.reponame);
    await this.createMetaSpaceConfigFile(this.taskConfig, repoPath);
  }
}
