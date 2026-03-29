/**
 * Vercel's Nest preset requires this file at the repo root and insists it
 * directly reference @nestjs/* (transitive imports are not enough).
 */
export { ValidationPipe } from '@nestjs/common';
export { NestFactory } from '@nestjs/core';
export { NestExpressApplication } from '@nestjs/platform-express';

import { bootstrapHttpApp } from '../apps/api/src/bootstrap-http';

bootstrapHttpApp();
