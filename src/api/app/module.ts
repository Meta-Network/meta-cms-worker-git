import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { WinstonModule } from 'nest-winston';
import { configBuilder } from 'src/configs';
import { CMSBackendMicroserviceClientService } from 'src/configs/cms';
import { WinstonConfigService } from 'src/configs/winston';

import { AppController } from './controller';
import { AppService } from './service';

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
    ClientsModule.registerAsync([
      {
        name: 'CMS_BACKEND_SERVICE',
        inject: [ConfigService],
        useClass: CMSBackendMicroserviceClientService,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
