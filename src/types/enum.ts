enum GitServiceEnum {
  GITHUB = 'GITHUB',
  GITEE = 'GITEE',
}
export type GitServiceType = GitServiceEnum;
export const GitServiceType = { ...GitServiceEnum };

export enum TemplateType {
  HEXO = 'HEXO',
}

enum GitTaskMethod {
  CREATE_REPO_FROM_TEMPLATE = 'CREATE_REPO_FROM_TEMPLATE',
}
export type TaskMethod = GitTaskMethod;
export const TaskMethod = { ...GitTaskMethod };
