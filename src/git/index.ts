import { MetaWorker } from '@metaio/worker-model';
import fs from 'fs';
import fsp from 'fs/promises';
import fse from 'fs-extra';
import Git, { Repository, Signature } from 'nodegit';
import os from 'os';
import path from 'path';

import { logger } from '../logger';
import { DownloadRepositoryArchiveReturn } from '../types';
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
  constructor(
    private readonly taskConfig: MetaWorker.Configs.GitWorkerTaskConfig,
  ) {
    const dirName = taskConfig.taskWorkspace;

    const baseDir = `${path.join(os.tmpdir(), dirName)}`;
    fs.mkdirSync(baseDir, { recursive: true });
    logger.info(`Git temporary directory is created, path: ${baseDir}`);

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
      logger.info(`Git remote url is: ${remoteUrl}`);
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
    logger.info(`Template directory is ${_cPath}`);

    if (rawName) {
      const files = await fsp.readdir(_cPath);
      const rawNameNoExt = path.basename(rawName, path.extname(rawName));
      if (files.includes(rawNameNoExt)) _cPath = `${_cPath}/${rawNameNoExt}`;
    }

    logger.info(`Copy template files from ${_cPath} to ${rPath}`);
    await fse.copy(_cPath, rPath, { recursive: true, overwrite: true });
  }

  async createRepoFromTemplate(): Promise<Repository> {
    const {
      gitType,
      gitReponame,
      gitBranchName,
      templateRepoUrl,
      templateBranchName,
    } = this.taskConfig;
    const repoPath = `${this.baseDir}/${gitReponame}`;

    logger.info(`Initialize repo ${gitReponame} to ${repoPath}`);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _localRepo = await Git.Repository.initExt(repoPath, {
      flags: 16, // 1u << 4, https://github.com/nodegit/libgit2/blob/a807e37df4ca3f60df7e9675e3c8049a21dd6283/include/git2/repository.h#L256
      initialHead: gitBranchName,
    });

    logger.info(`Download template zip archive from ${templateRepoUrl}`);
    const _archive = await this.downloadTemplateFromUrl(
      gitType,
      templateRepoUrl,
      templateBranchName,
    );

    const { filePath, rawFileName } = _archive;

    logger.info(`Decompress template archive ${filePath}`);
    const _template = await this.decompressTemplateArchive(filePath);

    await this.copyTemplateFilesIntoRepo(_template, repoPath, rawFileName);

    const _index = await _localRepo.refreshIndex();
    const _addAll = await _index.addAll();
    if (_addAll === 0) logger.info(`Successful add all entries to index`);
    const _writeIndex = await _index.write();
    if (_writeIndex === 0) logger.info(`Successful write index`);
    const _oId = await _index.writeTree();

    const _commit = await _localRepo.createCommit(
      'HEAD',
      this.signature,
      this.signature,
      'Initial commit.',
      _oId,
      [],
    );
    logger.info(`Create initial commit with commit hash ${_commit.tostrS()}`);

    return _localRepo;
  }

  async pushLocalRepoToRemote(repo: Repository): Promise<void> {
    const { gitType, gitToken, gitUsername, gitReponame, gitBranchName } =
      this.taskConfig;
    const _remoteUrls = await this.buildRemoteHttpUrlWithToken(
      gitType,
      gitToken,
      gitUsername,
      gitReponame,
    );
    const { remoteUrl, originUrl } = _remoteUrls;
    const _remote = await Git.Remote.create(repo, 'origin', remoteUrl);

    logger.info(
      `Pushing local repository to remote origin ${originUrl}, branch ${gitBranchName}`,
    );
    await _remote.push([
      `refs/heads/${gitBranchName}:refs/heads/${gitBranchName}`,
    ]);
    logger.info(`Successfully pushed to ${originUrl}`);
  }
}
