import type { IncomingMessage } from 'node:http';
import { ValidationPipe, type ValidationError } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ApiError } from './common/errors/api-error';
import { ErrorCode } from './common/errors/error-codes';
import { ApiErrorFilter } from './common/errors/error.filter';
import { NoStoreInterceptor } from './common/http/no-store.interceptor';

export const API_PREFIX = 'api/v1';

// Blob uploads stream their raw body into the cipher; a .json file must not be swallowed by the JSON parser.
const BLOB_UPLOAD_PATH = /\/files\/[^/?]+\/blob(?:\?|$)/;
const JSON_TYPE = /^application\/json\s*(?:;|$)/i;

function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
  out: Record<string, string> = {},
): Record<string, string> {
  for (const err of errors) {
    const path = parent ? `${parent}.${err.property}` : err.property;
    const first = err.constraints ? Object.values(err.constraints)[0] : undefined;
    if (first && !(path in out)) out[path] = first;
    if (err.children?.length) flattenValidationErrors(err.children, path, out);
  }
  return out;
}

/** Shared by main.ts, openapi.ts and the integration test app so all run the same pipeline. */
export function configureApp(app: NestExpressApplication): void {
  // Only a local reverse proxy can reach the bound loopback port, so its X-Forwarded-For is trusted.
  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.useBodyParser('json', {
    limit: '1mb',
    type: (req: IncomingMessage) =>
      !BLOB_UPLOAD_PATH.test(req.url ?? '') && JSON_TYPE.test(req.headers['content-type'] ?? ''),
  });
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new ApiError(ErrorCode.VALIDATION_FAILED, 422, undefined, flattenValidationErrors(errors)),
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.useGlobalInterceptors(new NoStoreInterceptor());
}
