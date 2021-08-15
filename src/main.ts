import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './api/app/module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService>(ConfigService);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(configService.get<string>('app.name'))
    .setDescription('CMS Worker for Git')
    .setVersion(process.env.npm_package_version || '0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    customCss: '.swagger-ui tr { display: block; padding: 10px 0; }',
  });

  await app.listen(3000);
}
bootstrap();
