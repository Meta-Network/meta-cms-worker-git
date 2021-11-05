import { URL } from 'url';

import { logger } from '../../logger';
import {
  BuildBasicInfoFromTemplateUrl,
  BuildRemoteHttpUrlWithTokenReturn,
} from '../../types';

export class GiteeService {
  public static getServerUrl(): URL {
    return new URL('https://gitee.com');
  }

  public static getFetchUrl(owner: string, repo: string): string {
    const serviceUrl = this.getServerUrl();
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    return `${serviceUrl.origin}/${encodedOwner}/${encodedRepo}.git`;
  }

  public static getBasicCredential(token: string, owner: string): string {
    const basicCredential = Buffer.from(`${owner}:${token}`, 'utf8').toString(
      'base64',
    );
    return basicCredential;
  }

  public static async buildRemoteGitUrl(
    owner: string,
    repo: string,
  ): Promise<string> {
    const remoteUrl = `https://gitee.com/${owner}/${repo}.git`;
    logger.info(`Git remote url is: ${remoteUrl}`, this.constructor.name);
    return remoteUrl;
  }

  public static async buildRemoteGitUrlWithToken(
    token: string,
    owner: string,
    repo: string,
  ): Promise<BuildRemoteHttpUrlWithTokenReturn> {
    const originUrl = await this.buildRemoteGitUrl(owner, repo);
    const remoteUrl = originUrl.replace(
      'gitee.com',
      `${owner}:${token}@gitee.com`,
    );
    return {
      originUrl,
      remoteUrl,
    };
  }

  public static async buildBasicInfoFromGitUrl(
    url: string,
  ): Promise<BuildBasicInfoFromTemplateUrl> {
    const info = url
      .replace('https://gitee.com/', '')
      .replace('.git', '')
      .split('/');
    return { owner: info[0], repo: info[1] };
  }
}
