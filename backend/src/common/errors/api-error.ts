import { DEFAULT_ERROR_MESSAGE, type ErrorCode } from './error-codes';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string = DEFAULT_ERROR_MESSAGE[code],
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
}
