import { isDeployTask, isPublishTask } from '@metaio/worker-common';
import { MetaWorker } from '@metaio/worker-model';
import fs from 'fs';
import fsp from 'fs/promises';
import fse from 'fs-extra';
import Git, { Repository, Signature } from 'nodegit';
import os from 'os';
import path from 'path';
import yaml from 'yaml';

import { logger } from '../logger';
import {
  BuildBasicInfoFromTemplateUrl,
  BuildRemoteHttpUrlWithTokenReturn,
  DownloadRepositoryArchiveReturn,
  LogContext,
  MixedTaskConfig,
} from '../types';
import { GiteeService } from './gitee';
import { GitHubService } from './github';
import { ZipArchiveService } from './zip';

type SpecificFrameworkInfo = {
  themeDirName: string;
  sourceDirName: string;
};

export class GitService {
  constructor(private readonly taskConfig: MixedTaskConfig) {
    this.context = { context: GitService.name };

    const { task } = this.taskConfig;
    const dirName = task.taskWorkspace;
    logger.info(`Task workspace is ${dirName}`, this.context);

    const baseDir = path.join(os.tmpdir(), dirName);
    fs.mkdirSync(baseDir, { recursive: true });
    logger.info(
      `Git temporary directory is created, path: ${baseDir}`,
      this.context,
    );

    this.baseDir = baseDir;

    this.signature = Git.Signature.now('Meta Network', 'noreply@meta.io');
  }

  private readonly context: LogContext;
  private readonly baseDir: string;
  private readonly signature: Signature;

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
    await fse.copy(_cPath, rPath, { recursive: true, overwrite: true });
  }

  private async initializeRepository(
    repoName: string,
    branch: string,
  ): Promise<Repository> {
    const repoPath = path.join(this.baseDir, repoName);
    logger.info(`Initialize repository from ${repoPath}`, this.context);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return await Git.Repository.initExt(repoPath, {
      flags: 16, // 1u << 4, https://github.com/nodegit/libgit2/blob/a807e37df4ca3f60df7e9675e3c8049a21dd6283/include/git2/repository.h#L256
      initialHead: branch,
    });
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
    const workPath = path.join(this.baseDir, workDir);
    await fsp.mkdir(workPath, { recursive: true });
    const filePath = path.join(workPath, '.nojekyll');
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
    const workPath = path.join(this.baseDir, workDir);
    await fsp.mkdir(workPath, { recursive: true });
    const filePath = path.join(this.baseDir, workDir, 'CNAME');
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

  async createRepoFromTemplate(): Promise<Repository> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);
    const {
      git: { storage },
      template,
    } = this.taskConfig;
    const { reponame, branchName, serviceType } = storage;

    const _localRepo = await this.initializeRepository(reponame, branchName);

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

    return _localRepo;
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
    await fse.copy(sourcePath, backupPath, {
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
    await fse.copy(backupPath, sourcePath, {
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

  async commitAllChangesWithMessage(
    repo: Repository,
    msg: string,
  ): Promise<void> {
    const _index = await repo.refreshIndex();
    const _addAll = await _index.addAll();
    logger.info(
      `Successful add all entries to index, code: ${_addAll}`,
      this.context,
    );
    const _writeIndex = await _index.write();
    logger.info(`Successful write index, code: ${_writeIndex}`, this.context);
    const _oId = await _index.writeTree();

    const _parents = [];
    const _parent = await repo.getHeadCommit();
    if (_parent !== null) {
      logger.info(`Successful get parent commit`, this.context);
      _parents.push(_parent);
    }

    const _commit = await repo.createCommit(
      'HEAD',
      this.signature,
      this.signature,
      msg,
      _oId,
      _parents,
    );
    logger.info(
      `Create ${msg} with commit hash ${_commit.tostrS()}`,
      this.context,
    );
  }

  async pushLocalRepoToRemote(
    repo: Repository,
    info: MetaWorker.Info.Git,
    branch?: string,
    force?: boolean,
  ): Promise<void> {
    const { serviceType, token, username, reponame, branchName } = info;

    if (!branch) branch = branchName;

    const _remoteUrls = await this.buildRemoteGitUrlWithToken(
      serviceType,
      token,
      username,
      reponame,
    );
    const { remoteUrl, originUrl } = _remoteUrls;

    let _remote: Git.Remote;

    try {
      logger.info(`Lookup repository remote`, this.context);
      _remote = await Git.Remote.lookup(repo, 'origin');
      const _remoteName = _remote.name();
      logger.info(`Remote '${_remoteName}' found`, this.context);
    } catch (error) {
      logger.info(
        `Remote 'origin' does not exist, creating remote 'origin'`,
        this.context,
      );
      _remote = await Git.Remote.create(repo, 'origin', remoteUrl);
    }

    logger.info(
      `Pushing local repository to remote origin ${originUrl}, branch ${branch}`,
      this.context,
    );
    await _remote.push([
      `${force ? '+' : ''}refs/heads/${branch}:refs/heads/${branch}`,
    ]);
    logger.info(`Successfully pushed to ${originUrl}`, this.context);
  }

  async publishSiteToGitHubPages(): Promise<void> {
    if (!isPublishTask(this.taskConfig))
      throw new Error('Task config is not for publish site');
    const {
      publish,
      site,
      git: { publisher, storage },
    } = this.taskConfig;
    const { reponame } = storage;
    const { publishDir, publishBranch } = publish;
    const workDir = `${reponame}/${publishDir}`;

    await this.createNoJekyllFile(workDir);
    const { domain } = site;
    await this.createCNameFile(workDir, domain);

    const _repo = await this.initializeRepository(workDir, publishBranch);
    await this.commitAllChangesWithMessage(_repo, `Publish ${Date.now()}`);
    // Use force push
    await this.pushLocalRepoToRemote(_repo, publisher, publishBranch, true);
  }

  async generateMetaSpaceConfig(): Promise<void> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);
    const {
      git: { storage },
    } = this.taskConfig;
    const repoPath = path.join(this.baseDir, storage.reponame);
    await this.createMetaSpaceConfigFile(this.taskConfig, repoPath);
  }
}
