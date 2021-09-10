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

    logger.info(`Downloading file from ${_res.url}`, {
      context: GitHubService.name,
    });

    const fileName = file;
    const filePath = `${this.tmpDir}/${fileName}`;
    await fs.writeFile(filePath, Buffer.from(_res.data));
    logger.info(`File ${filePath} download complete`, {
      context: GitHubService.name,
    });

    return { fileName, filePath, rawFileName };
  }
}
