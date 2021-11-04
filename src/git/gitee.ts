import { logger } from '../logger';
import {
  BuildBasicInfoFromTemplateUrl,
  BuildRemoteHttpUrlWithTokenReturn,
} from '../types';

export class GiteeService {
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
