import { isDeployTask, isPublishTask } from '@metaio/worker-common';
import { MetaWorker } from '@metaio/worker-model';
import fs from 'fs';
import fsp from 'fs/promises';
import fse from 'fs-extra';
import Git, { Repository, Signature } from 'nodegit';
import os from 'os';
import path from 'path';

import { logger } from '../logger';
import { DownloadRepositoryArchiveReturn, MixedTaskConfig } from '../types';
import { GitHubService } from './github';
import { ZipArchiveService } from './zip';

type BuildRemoteHttpUrlWithTokenReturn = {
  originUrl: string;
  remoteUrl: string;
};

type BuildBasicInfoFromTemplateUrl = {
  owner: string;
  repo: string;
};

export class GitService {
  constructor(private readonly taskConfig: MixedTaskConfig) {
    const { task } = taskConfig;
    const dirName = task.taskWorkspace;
    logger.info(`Task workspace is ${dirName}`, { context: GitService.name });

    const baseDir = `${path.join(os.tmpdir(), dirName)}`;
    fs.mkdirSync(baseDir, { recursive: true });
    logger.info(`Git temporary directory is created, path: ${baseDir}`, {
      context: GitService.name,
    });

    this.baseDir = baseDir;

    this.signature = Git.Signature.now('Meta Network', 'noreply@meta.io');
  }

  private readonly baseDir: string;

  private readonly signature: Signature;

  private async buildRemoteHttpUrl(
    type: MetaWorker.Enums.GitServiceType,
    uname: string,
    rname: string,
  ): Promise<string> {
    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      const remoteUrl = `https://github.com/${uname}/${rname}.git`;
      logger.info(`Git remote url is: ${remoteUrl}`, {
        context: GitService.name,
      });
      return remoteUrl;
    }
    // TODO: Unsupport type
  }

  private async buildRemoteHttpUrlWithToken(
    type: MetaWorker.Enums.GitServiceType,
    token: string,
    uname: string,
    rname: string,
  ): Promise<BuildRemoteHttpUrlWithTokenReturn> {
    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
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

  private async buildBasicInfoFromTemplateUrl(
    type: MetaWorker.Enums.GitServiceType,
    url: string,
  ): Promise<BuildBasicInfoFromTemplateUrl> {
    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      const info = url
        .replace('https://github.com/', '')
        .replace('.git', '')
        .split('/');
      return { owner: info[0], repo: info[1] };
    }
    // TODO: Unsupport type
  }

  private async downloadTemplateFromUrl(
    type: MetaWorker.Enums.GitServiceType,
    url: string,
    branch?: string,
  ): Promise<DownloadRepositoryArchiveReturn> {
    const { owner, repo } = await this.buildBasicInfoFromTemplateUrl(type, url);

    if (type === MetaWorker.Enums.GitServiceType.GITHUB) {
      const github = new GitHubService(this.baseDir);
      return await github.downloadRepositoryArchive(owner, repo, branch);
    }
    // TODO: Unsupport type
  }

  private async decompressTemplateArchive(path: string): Promise<string> {
    const output = `${this.baseDir}/template`;

    const zip = new ZipArchiveService();

    return await zip.extractAllFiles(path, output);
  }

  private async copyTemplateFilesIntoRepo(
    tPath: string,
    rPath: string,
    rawName?: string,
  ): Promise<void> {
    let _cPath = tPath.replace(path.extname(tPath), '');
    logger.info(`Template directory is ${_cPath}`, {
      context: GitService.name,
    });

    if (rawName) {
      const files = await fsp.readdir(_cPath);
      const rawNameNoExt = path.basename(rawName, path.extname(rawName));
      if (files.includes(rawNameNoExt)) _cPath = `${_cPath}/${rawNameNoExt}`;
    }

    logger.info(`Copy template files from ${_cPath} to ${rPath}`, {
      context: GitService.name,
    });
    await fse.copy(_cPath, rPath, { recursive: true, overwrite: true });
  }

  // For publisher
  private async createNoJekyllFile(
    workDir: string,
    disableNoJekyll?: boolean,
  ): Promise<void> {
    if (disableNoJekyll) return;
    const filePath = path.join(this.baseDir, workDir, '.nojekyll');
    const isExists = fs.existsSync(filePath);
    if (isExists) return;
    await fsp.writeFile(filePath, '\n');
    logger.info(`Successful create .nojekyll file, path: ${filePath}`, {
      context: GitService.name,
    });
  }

  private async createCNameFile(
    workDir: string,
    content: string,
  ): Promise<void> {
    if (!content) return;
    const filePath = path.join(this.baseDir, workDir, 'CNAME');
    const isExists = fs.existsSync(filePath);
    if (isExists) {
      logger.info(`CNAME file already exists`, { context: GitService.name });
      return;
    }
    await fsp.writeFile(filePath, `${content}\n`);
    logger.info(`Successful create CNAME file, path: ${filePath}`, {
      context: GitService.name,
    });
  }

  async createRepoFromTemplate(): Promise<Repository> {
    if (!isDeployTask(this.taskConfig))
      throw new Error(`Task config is not for deploy`);
    const { git, template } = this.taskConfig;
    const { gitType, gitReponame, gitBranchName } = git;
    const { templateRepoUrl, templateBranchName } = template;
    const repoPath = `${this.baseDir}/${gitReponame}`;

    logger.info(`Initialize repo ${gitReponame} to ${repoPath}`, {
      context: GitService.name,
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _localRepo = await Git.Repository.initExt(repoPath, {
      flags: 16, // 1u << 4, https://github.com/nodegit/libgit2/blob/a807e37df4ca3f60df7e9675e3c8049a21dd6283/include/git2/repository.h#L256
      initialHead: gitBranchName,
    });

    logger.info(`Download template zip archive from ${templateRepoUrl}`, {
      context: GitService.name,
    });
    const _archive = await this.downloadTemplateFromUrl(
      gitType,
      templateRepoUrl,
      templateBranchName,
    );

    const { filePath, rawFileName } = _archive;

    logger.info(`Decompress template archive ${filePath}`, {
      context: GitService.name,
    });
    const _template = await this.decompressTemplateArchive(filePath);

    await this.copyTemplateFilesIntoRepo(_template, repoPath, rawFileName);

    return _localRepo;
  }

  async cloneAndCheckoutFromRemote(): Promise<Repository> {
    const { git } = this.taskConfig;
    const { gitType, gitToken, gitUsername, gitReponame, gitBranchName } = git;
    const repoPath = `${this.baseDir}/${gitReponame}`;
    const _remoteUrls = await this.buildRemoteHttpUrlWithToken(
      gitType,
      gitToken,
      gitUsername,
      gitReponame,
    );
    const { remoteUrl } = _remoteUrls;
    logger.info(`Clone repo ${gitReponame} to ${repoPath}`, {
      context: GitService.name,
    });
    const _localRepo = await Git.Clone.clone(remoteUrl, repoPath, {
      checkoutBranch: gitBranchName,
    });
    return _localRepo;
  }

  async openRepoFromLocal(): Promise<Repository> {
    const { git } = this.taskConfig;
    const { gitReponame, gitBranchName } = git;
    const repoPath = `${this.baseDir}/${gitReponame}`;
    logger.info(`Open repo ${gitReponame} from ${repoPath}`, {
      context: GitService.name,
    });
    const _localRepo = await Git.Repository.open(repoPath);
    logger.info(`Checkout branch ${gitBranchName}`, {
      context: GitService.name,
    });
    await _localRepo.checkoutBranch(gitBranchName);
    logger.info(`Successful checkout branch ${gitBranchName}`, {
      context: GitService.name,
    });
    return _localRepo;
  }

  async commitAllChangesWithMessage(
    repo: Repository,
    msg: string,
    withParrent = false,
  ): Promise<void> {
    const _index = await repo.refreshIndex();
    const _addAll = await _index.addAll();
    if (_addAll)
      logger.info(`Successful add all entries to index`, {
        context: GitService.name,
      });
    const _writeIndex = await _index.write();
    if (_writeIndex)
      logger.info(`Successful write index`, { context: GitService.name });
    const _oId = await _index.writeTree();

    const _parents = [];
    if (withParrent) {
      const _parent = await repo.getHeadCommit();
      if (_parent)
        logger.info(`Successful get head commit`, { context: GitService.name });
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
    logger.info(`Create ${msg} with commit hash ${_commit.tostrS()}`, {
      context: GitService.name,
    });
  }

  async pushLocalRepoToRemote(
    repo: Repository,
    branch?: string,
  ): Promise<void> {
    const { git } = this.taskConfig;
    const { gitType, gitToken, gitUsername, gitReponame, gitBranchName } = git;

    if (!branch) branch = gitBranchName;

    const _remoteUrls = await this.buildRemoteHttpUrlWithToken(
      gitType,
      gitToken,
      gitUsername,
      gitReponame,
    );
    const { remoteUrl, originUrl } = _remoteUrls;

    let _remote: Git.Remote;

    logger.info(`Lookup repository remote`, { context: GitService.name });
    _remote = await Git.Remote.lookup(repo, 'origin');
    const _remoteName = _remote.name();
    if (!(_remoteName === 'origin')) {
      _remote = await Git.Remote.create(repo, 'origin', remoteUrl);
    }

    logger.info(
      `Pushing local repository to remote origin ${originUrl}, branch ${branch}`,
      { context: GitService.name },
    );
    await _remote.push([`refs/heads/${branch}:refs/heads/${branch}`]);
    logger.info(`Successfully pushed to ${originUrl}`, {
      context: GitService.name,
    });
  }

  async publishSiteToGitHubPages(): Promise<void> {
    if (!isPublishTask(this.taskConfig))
      throw new Error('Task config is not for publish site');
    const { site } = this.taskConfig;
    const { domain } = site;
    const workDir = 'public'; // TODO: maybe configable
    await this.createNoJekyllFile(workDir);
    await this.createCNameFile(workDir, `https://${domain}`);
  }
}
