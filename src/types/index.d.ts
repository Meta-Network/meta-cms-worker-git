import { MetaWorker } from '@metaio/worker-model';

export type DownloadRepositoryArchiveReturn = {
  filePath: string;
  fileName: string;
  rawFileName: string;
};

export type MixedTaskConfig =
  | MetaWorker.Configs.DeployTaskConfig
  | MetaWorker.Configs.PublishTaskConfig;
