import 'reflect-metadata';
import { loadEnv, apiPort } from './env';

loadEnv();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './shared/api-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('CHPLI2 API')
    .setDescription('CHPLI personal system API (Travel + Calendar slice)')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule does not apply the global prefix, so include it explicitly.
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(apiPort());
  // eslint-disable-next-line no-console
  console.log(`CHPLI API listening on http://localhost:${apiPort()}/api`);
}

void bootstrap();
