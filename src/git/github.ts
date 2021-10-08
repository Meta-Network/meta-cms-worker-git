import { Octokit } from '@octokit/core';
import fs from 'fs/promises';

import { logger } from '../logger';
import { DownloadRepositoryArchiveReturn } from '../types';

export class GitHubService {
  constructor(private readonly tmpDir: string) {
    this.octokit = new Octokit();
  }

  private readonly octokit: Octokit;

  async downloadRepositoryArchive(
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
    const filePath = `${this.tmpDir}/${fileName}`;
    await fs.writeFile(filePath, Buffer.from(_res.data));
    logger.info(`File ${filePath} download complete`, {
      context: GitHubService.name,
    });

    const findStr = `${owner}-${repo}`;
    logger.info(`Find string is ${findStr}`, { context: GitHubService.name });

    return { fileName, filePath, findStr };
  }
}
