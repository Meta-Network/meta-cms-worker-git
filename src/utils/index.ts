export const removeControlCharacters = (str: string): string => {
  return str
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
};
