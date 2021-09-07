export type RemoveIndex<Q> = {
  [key in keyof Q as string extends key
    ? never
    : key extends string
    ? key
    : never]: Q[key];
};

export type DownloadRepositoryArchiveReturn = {
  filePath: string;
  fileName: string;
  rawFileName: string;
};
