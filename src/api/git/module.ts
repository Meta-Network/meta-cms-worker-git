import { Module } from '@nestjs/common';

import { LoggerModule } from '../logger/module';
import { GitService } from './service';

@Module({
  imports: [LoggerModule],
  providers: [GitService],
  exports: [GitService],
})
export class GitModule {}
