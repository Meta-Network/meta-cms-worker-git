import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { CMSBackendMicroserviceClientService } from 'src/configs/cms';
import { Microservice } from 'src/constants';

import { GitModule } from '../git/module';
import { LoggerModule } from '../logger/module';
import { TasksService } from './service';

@Module({
  imports: [
    LoggerModule,
    ClientsModule.registerAsync([
      {
        name: Microservice.CMS_BACKEND,
        inject: [ConfigService],
        useClass: CMSBackendMicroserviceClientService,
      },
    ]),
    GitModule,
  ],
  providers: [TasksService],
})
export class TasksModule {}
