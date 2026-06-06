import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { bootstrapEnv } from '@boosters/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const env = bootstrapEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: env.API_CORS_ORIGIN, credentials: true });

  await app.listen(env.API_PORT, env.API_HOST);
  Logger.log(
    `Boosters API on http://${env.API_HOST}:${env.API_PORT}/api (cluster=${env.SOLANA_CLUSTER}, payments=${env.PAYMENTS_MODE})`,
    'Bootstrap',
  );
}

void bootstrap();
