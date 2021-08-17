import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { configBuilder } from 'src/configs';
import { WinstonConfigService } from 'src/configs/winston';

import { TasksModule } from '../task/module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configBuilder],
    }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useClass: WinstonConfigService,
    }),
    ScheduleModule.forRoot(),
    TasksModule,
  ],
})
export class AppModule {}
