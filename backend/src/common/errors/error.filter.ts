import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ApiError, type ErrorBody } from './api-error';
import { DEFAULT_ERROR_MESSAGE, ErrorCode } from './error-codes';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTH_REQUIRED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCode.NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.TEMPORARILY_UNAVAILABLE,
};

interface NormalizedError {
  status: number;
  body: ErrorBody;
}

function envelope(code: ErrorCode, message: string, fields?: Record<string, string>): ErrorBody {
  return fields && Object.keys(fields).length > 0 ? { error: { code, message, fields } } : { error: { code, message } };
}

export function normalizeError(exception: unknown): NormalizedError {
  if (exception instanceof ApiError) {
    return { status: exception.status, body: envelope(exception.code, exception.message, exception.fields) };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = STATUS_TO_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL : ErrorCode.VALIDATION_FAILED);
    return { status, body: envelope(code, DEFAULT_ERROR_MESSAGE[code]) };
  }
  // body-parser errors (oversized/malformed JSON) arrive as plain errors carrying a status.
  const parserError = exception as { type?: string; status?: number } | null;
  if (parserError && typeof parserError.status === 'number' && typeof parserError.type === 'string') {
    if (parserError.type === 'entity.too.large') {
      return { status: 413, body: envelope(ErrorCode.PAYLOAD_TOO_LARGE, DEFAULT_ERROR_MESSAGE.PAYLOAD_TOO_LARGE) };
    }
    if (parserError.status >= 400 && parserError.status < 500) {
      return { status: 400, body: envelope(ErrorCode.VALIDATION_FAILED, DEFAULT_ERROR_MESSAGE.VALIDATION_FAILED) };
    }
  }
  return { status: 500, body: envelope(ErrorCode.INTERNAL, DEFAULT_ERROR_MESSAGE.INTERNAL) };
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = normalizeError(exception);
    if (status >= 500) {
      // Only the error name is logged: messages from drivers may echo user content (LOC-001).
      const name = exception instanceof Error ? exception.name : typeof exception;
      console.error(`[api] unhandled error: ${name}`);
    }
    if (res.headersSent) return;
    res.setHeader('Cache-Control', 'no-store');
    res.status(status).json(body);
  }
}
