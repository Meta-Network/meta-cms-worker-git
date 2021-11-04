import { MetaWorker } from '@metaio/worker-model';

export type DownloadRepositoryArchiveReturn = {
  filePath: string;
  fileName: string;
  findStr: string;
};

export type MixedTaskConfig =
  | MetaWorker.Configs.DeployTaskConfig
  | MetaWorker.Configs.PublishTaskConfig;

export type LogContext = {
  context: string;
};

export type BuildRemoteHttpUrlWithTokenReturn = {
  originUrl: string;
  remoteUrl: string;
};

export type BuildBasicInfoFromTemplateUrl = {
  owner: string;
  repo: string;
};
