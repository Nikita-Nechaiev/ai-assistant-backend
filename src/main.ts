import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
import helmet from 'helmet';

async function start() {
  try {
    const PORT = process.env.PORT || 5000;
    const app = await NestFactory.create(AppModule);

    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }),
    );

    app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));
    app.use(cookieParser());

    await app.listen(PORT);
    console.log(`Server started on PORT ${PORT}`);
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

start();
