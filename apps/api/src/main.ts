import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { bootstrapEnv } from '@boosters/config';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';

async function bootstrap() {
  const env = bootstrapEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: false,
    rawBody: true,
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({ origin: env.API_CORS_ORIGIN, credentials: true });
  app.enableShutdownHooks(); // graceful SIGTERM/SIGINT

  // Baseline security headers (no extra dependency).
  const instance = app.getHttpAdapter().getInstance();
  instance.addHook('onSend', (_req, reply, payload, done) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    done(null, payload);
  });

  await app.listen(env.API_PORT, env.API_HOST);
  Logger.log(
    `Boosters API on http://${env.API_HOST}:${env.API_PORT}/api (cluster=${env.SOLANA_CLUSTER}, payments=${env.PAYMENTS_MODE}/${env.PAYMENTS_PROVIDER})`,
    'Bootstrap',
  );
}

void bootstrap();
