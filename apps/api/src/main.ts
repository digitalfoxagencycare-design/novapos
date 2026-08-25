import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Fail fast on a misconfigured deployment.
 *
 * A POS that boots with a placeholder JWT secret is worse than one that
 * refuses to boot: it looks healthy while every token it issues is forgeable.
 */
function assertConfig() {
  const problems: string[] = [];
  const secret = process.env.JWT_SECRET;

  if (!secret) problems.push('JWT_SECRET is not set.');
  else if (secret.includes('CHANGE_ME')) problems.push('JWT_SECRET is still the placeholder from .env.example.');
  else if (secret.length < 32) problems.push('JWT_SECRET is shorter than 32 characters.');

  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is not set.');

  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    problems.push('CORS_ORIGINS must be set explicitly in production.');
  }

  if (problems.length) {
    // eslint-disable-next-line no-console
    console.error(
      '\nNovaPOS cannot start — the configuration is unsafe:\n' +
      problems.map((p) => `  · ${p}`).join('\n') +
      '\n\nCopy apps/api/.env.example to .env and fill it in. ' +
      'Generate a secret with:  openssl rand -base64 48\n',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  assertConfig();

  const app = await NestFactory.create(AppModule, {
    // The raw body is required to verify payment webhook signatures; the
    // parsed JSON re-serialises differently and the HMAC never matches.
    rawBody: true,
  });

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api/v1');

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length ? origins : true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Outlet-Id', 'X-Device-Id', 'X-Request-Id'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip properties with no DTO decorator
      forbidNonWhitelisted: true, // and reject rather than silently dropping
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true') {
    const config = new DocumentBuilder()
      .setTitle('NovaPOS API')
      .setDescription(
        'Multi-tenant POS + KOT platform. Every request is scoped to the tenant in the bearer token; ' +
        'there is no way to address another tenant’s data through this API.',
      )
      .setVersion('0.1.0')
      .addBearerAuth()
      .addGlobalParameters({
        name: 'X-Outlet-Id', in: 'header', required: false,
        description: 'Pin the request to a specific outlet. Must be one the token permits.',
      })
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`NovaPOS API listening on :${port} (docs at /api/docs)`, 'Bootstrap');
}

bootstrap();
