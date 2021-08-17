import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProvider,
  ClientsModuleOptionsFactory,
  Transport,
} from '@nestjs/microservices';

@Injectable()
export class CMSBackendMicroserviceClientService
  implements ClientsModuleOptionsFactory
{
  constructor(private readonly configService: ConfigService) {}

  async createClientOptions(): Promise<ClientProvider> {
    return {
      transport: Transport.TCP,
      options: {
        port: this.configService.get<number>('microservice.cmsBackend.port'),
      },
    };
  }
}
