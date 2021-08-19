import { GitServiceType, TaskMethod, TemplateType } from './enum';

export type UCenterUserInfo = {
  username: string;
  nickname?: string;
};

export type CMSSiteInfo = {
  title: string;
  subtitle?: string;
  description?: string;
  author?: string;
  keywords?: string[] | null;
  favicon?: string | null;
};

export type CMSSiteConfig = {
  configId: number;
  language?: string;
  timezone?: string;
  domain?: string;
};

export type TemplateInfo = {
  templateName: string;
  templateRepoUrl: string;
  templateBranchName: string;
  templateType?: TemplateType;
};

export type GitInfo = {
  gitToken: string;
  gitType: GitServiceType;
  gitUsername: string;
  gitReponame: string;
  gitBranchName: string;
  gitLastCommitHash?: string | null;
};

export type TaskInfo = {
  taskId: string;
  taskMethod: TaskMethod;
};

export type TaskConfig = TaskInfo &
  UCenterUserInfo &
  CMSSiteInfo &
  CMSSiteConfig &
  TemplateInfo &
  GitInfo;
