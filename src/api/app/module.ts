import { Module } from '@nestjs/common';
import { AppController } from './controller';
import { AppService } from './service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { configBuilder } from 'src/configs';
import { WinstonModule } from 'nest-winston';
import { WinstonConfigService } from 'src/configs/winston';
import { ClientsModule, Transport } from '@nestjs/microservices';

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
    ClientsModule.register([
      { name: 'CMS_BACKEND_SERVICE', transport: Transport.TCP },
    ]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
