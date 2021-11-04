import { Octokit } from '@octokit/core';
import fs from 'fs/promises';
import path from 'path';

import { logger } from '../../logger';
import {
  BuildBasicInfoFromTemplateUrl,
  BuildRemoteHttpUrlWithTokenReturn,
  DownloadRepositoryArchiveReturn,
} from '../../types';

export class GitHubService {
  public static async getServerUrl(): Promise<URL> {
    return new URL('https://github.com');
  }

  public static async getFetchUrl(
    owner: string,
    repo: string,
  ): Promise<string> {
    const serviceUrl = await this.getServerUrl();
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    return `${serviceUrl.origin}/${encodedOwner}/${encodedRepo}.git`;
  }

  constructor(private readonly tmpDir: string) {
    this.octokit = new Octokit();
  }

  private readonly octokit: Octokit;

  public async downloadRepositoryArchive(
    owner: string,
    repo: string,
    ref?: string,
    file = 'template.zip',
  ): Promise<DownloadRepositoryArchiveReturn> {
    let req = 'GET /repos/{owner}/{repo}/zipball';
    if (ref) req = req.concat('/{ref}');

    logger.info(`Start download ${owner}/${repo} zipball from branch ${ref}`, {
      context: GitHubService.name,
    });

    const _res = await this.octokit.request(req, {
      owner,
      repo,
      ref,
    });

    const disposition =
      _res.headers['Content-Disposition'] ||
      _res.headers['content-disposition'];
    const rawFileName = (disposition as string).replace(
      'attachment; filename=',
      '',
    );
    // rawFindName is unreliable,
    // for repo https://github.com/zoeingwingkei/frame.git,
    // rawFindName is zoeingwingkei-frame-v1.0-2-g1305c4b.zip
    // but inside the zip file, a subfolder name is zoeingwingkei-frame-1305c4
    logger.info(`Raw file name is ${rawFileName}`, {
      context: GitHubService.name,
    });

    logger.info(`Downloading file from ${_res.url}`, {
      context: GitHubService.name,
    });

    const fileName = file;
    const filePath = path.join(this.tmpDir, fileName);
    await fs.writeFile(filePath, Buffer.from(_res.data));
    logger.info(`File ${filePath} download complete`, {
      context: GitHubService.name,
    });

    const findStr = `${owner}-${repo}`;
    logger.info(`Find string is ${findStr}`, { context: GitHubService.name });

    return { fileName, filePath, findStr };
  }

  public static async buildRemoteGitUrl(
    owner: string,
    repo: string,
  ): Promise<string> {
    const remoteUrl = `https://github.com/${owner}/${repo}.git`;
    logger.info(`Git remote url is: ${remoteUrl}`, this.constructor.name);
    return remoteUrl;
  }

  public static async buildRemoteGitUrlWithToken(
    token: string,
    owner: string,
    repo: string,
  ): Promise<BuildRemoteHttpUrlWithTokenReturn> {
    const originUrl = await this.buildRemoteGitUrl(owner, repo);
    const pass = 'x-oauth-basic';
    const remoteUrl = originUrl.replace(
      'github.com',
      `${token}:${pass}@github.com`,
    );
    const result = {
      originUrl,
      remoteUrl,
    };
    return result;
  }

  public static async buildBasicInfoFromGitUrl(
    url: string,
  ): Promise<BuildBasicInfoFromTemplateUrl> {
    const info = url
      .replace('https://github.com/', '')
      .replace('.git', '')
      .split('/');
    return { owner: info[0], repo: info[1] };
  }
}
