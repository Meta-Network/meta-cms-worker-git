import process from 'process';

export const removeControlCharacters = (str: string): string => {
  return str
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
};

export const isUndefined = (obj: unknown): obj is undefined =>
  typeof obj === 'undefined';

export const isProd = (): boolean => {
  return process.env.NODE_ENV === 'production';
};
