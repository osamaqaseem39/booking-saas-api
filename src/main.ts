import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../apps/api/src/app.module';
import { applyHttpGlobals } from '../apps/api/src/bootstrap-http';

async function createExpressServer(): Promise<express.Express> {
  const expressApp = express();
  const nestApp = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  applyHttpGlobals(nestApp);
  await nestApp.init();
  return expressApp;
}

let serverPromise: Promise<express.Express> | undefined;

export default async function vercelHandler(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  if (!serverPromise) {
    serverPromise = createExpressServer();
  }
  const server = await serverPromise;
  server(req, res);
}

