import { ArgumentsHost, BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ApiError } from './api-error';
import { ErrorCode } from './error-codes';
import { ApiErrorFilter } from './error.filter';

function fakeHost() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    headersSent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'GET', url: '/x' }) }),
    getType: () => 'http',
  } as unknown as ArgumentsHost;
  return { res, host };
}

describe('ApiErrorFilter', () => {
  const filter = new ApiErrorFilter();

  it('renders ApiError as the error envelope with fields', () => {
    const { res, host } = fakeHost();
    filter.catch(new ApiError(ErrorCode.VALIDATION_FAILED, 422, 'Tiêu đề không hợp lệ', { title: 'Bắt buộc' }), host);
    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_FAILED', message: 'Tiêu đề không hợp lệ', fields: { title: 'Bắt buộc' } },
    });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('omits fields when absent', () => {
    const { res, host } = fakeHost();
    filter.catch(new ApiError(ErrorCode.FORBIDDEN, 403), host);
    expect(res.body).toEqual({ error: { code: 'FORBIDDEN', message: expect.any(String) } });
  });

  it('maps unknown errors to 500 INTERNAL without leaking details', () => {
    const { res, host } = fakeHost();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const err = new Error('secret SQL detail at line 42');
    filter.catch(err, host);
    spy.mockRestore();
    expect(res.statusCode).toBe(500);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('maps Nest HTTP exceptions to stable codes', () => {
    const cases: Array<[Error, number, string]> = [
      [new NotFoundException(), 404, 'NOT_FOUND'],
      [new PayloadTooLargeException(), 413, 'PAYLOAD_TOO_LARGE'],
      [new BadRequestException(), 400, 'VALIDATION_FAILED'],
    ];
    for (const [err, status, code] of cases) {
      const { res, host } = fakeHost();
      filter.catch(err, host);
      expect(res.statusCode).toBe(status);
      expect((res.body as { error: { code: string } }).error.code).toBe(code);
    }
  });

  it('maps body-parser entity.too.large errors to 413', () => {
    const { res, host } = fakeHost();
    const err = Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 });
    filter.catch(err, host);
    expect(res.statusCode).toBe(413);
    expect((res.body as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
