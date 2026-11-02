import { execSync } from 'node:child_process';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/shared/api-exception.filter';
import { PrismaService } from '../src/shared/prisma.service';
import { seedReferenceData } from '../src/travel/seed-reference-data';

/** Applies the latest migrations to the database configured by DATABASE_URL. */
export function migrateDeploy(): void {
  execSync('pnpm exec prisma migrate deploy', { stdio: 'ignore' });
}

/** Boots the full Nest application with the same setup as production. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
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
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  await app.init();
  return app;
}

/** Removes all rows this test suite may have created (FK-safe order). */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.calendarEvent.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.transport.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.location.deleteMany();
  await prisma.city.deleteMany();
  await prisma.country.deleteMany();
}

/** Seeds the development reference data (idempotent). */
export async function seed(app: INestApplication) {
  return seedReferenceData(app.get(PrismaService));
}

/** supertest bound to the Nest HTTP server. */
export function api(app: INestApplication) {
  return request(app.getHttpServer() as Express);
}

/** Polls until `fn` returns true or the timeout expires. */
export async function waitFor(
  fn: () => Promise<boolean>,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await fn()) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error('waitFor: condition was not met before timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
