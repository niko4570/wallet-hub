import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const maxBodyBytes = Number(process.env.SESSION_MAX_BODY_BYTES ?? 65536);
  app.use(json({ limit: maxBodyBytes }));
  app.use(urlencoded({ extended: true, limit: maxBodyBytes }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor());

  const port = process.env.PORT ? Number(process.env.PORT) : 10000;
  const host = process.env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`WalletHub API running on http://${host}:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap().catch((error) => {
  console.error('Failed to bootstrap Nest app:', error);
  process.exit(1);
});
