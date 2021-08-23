import SevenZip from 'node-7z';
import which from 'which';

import { config } from '../configs';
import { logger } from '../logger';

export class ZipArchiveService {
  constructor() {
    const bin = config.get<string>('sevenZip.binName');

    if (!bin)
      throw new Error('ZipArchiveService: can not get bin name in config');

    const path = which.sync(bin);

    this.bin = bin;
    this.binPath = path;

    logger.info(`ZipArchiveService use ${this.bin} from ${this.binPath}`);
  }

  private readonly bin: string;
  private readonly binPath: string;

  async extractAllFiles(file: string, output: string): Promise<string> {
    const extractFile = new Promise<string>((res, rej) => {
      logger.info(`Extracting file to ${output}`);
      const stream = SevenZip.extractFull(file, output, { $bin: this.binPath });
      stream.on('data', (data) => {
        logger.info(`File ${data.file} ${data.status}`);
      });
      stream.on('end', () => {
        logger.info('Extract completed');
        res(output);
      });
      stream.on('error', (err) => {
        logger.error(err, '7zip::decompressTemplateArchive');
        rej(err);
      });
    });
    return extractFile;
  }
}
