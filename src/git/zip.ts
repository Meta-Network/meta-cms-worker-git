import SevenZip from 'node-7z';
import which from 'which';

import { config } from '../configs';
import { logger } from '../logger';

export class ZipArchiveService {
  constructor() {
    const bin = config.get<string>('WORKER_7ZIP_BIN_NAME');
    if (!bin)
      throw Error('ZipArchiveService: Can not find WORKER_7ZIP_BIN_NAME env');

    const path = which.sync(bin);

    this.bin = bin;
    this.binPath = path;

    logger.info(`ZipArchiveService use ${this.bin} from ${this.binPath}`, {
      context: ZipArchiveService.name,
    });
  }

  private readonly bin: string;
  private readonly binPath: string;

  async extractAllFiles(file: string, output: string): Promise<string> {
    const extractFile = new Promise<string>((res, rej) => {
      logger.info(`Extracting file to ${output}`, {
        context: ZipArchiveService.name,
      });
      const stream = SevenZip.extractFull(file, output, { $bin: this.binPath });
      stream.on('data', (data) => {
        logger.info(`File ${data.file} ${data.status}`, {
          context: ZipArchiveService.name,
        });
      });
      stream.on('end', () => {
        logger.info('Extract completed', { context: ZipArchiveService.name });
        res(output);
      });
      stream.on('error', (err) => {
        logger.error('7zip::decompressTemplateArchive', err, {
          context: ZipArchiveService.name,
        });
        rej(err);
      });
    });
    return extractFile;
  }
}
