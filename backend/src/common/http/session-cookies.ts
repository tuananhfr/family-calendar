import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'fc_sid';
export const CSRF_COOKIE = 'fc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

function baseOptions(secure: boolean): CookieOptions {
  return { sameSite: 'lax', secure, path: '/' };
}

export function setSessionCookies(
  res: Response,
  tokens: { sessionToken: string; csrfToken: string },
  opts: { secure: boolean; maxAgeMs: number },
): void {
  res.cookie(SESSION_COOKIE, tokens.sessionToken, {
    ...baseOptions(opts.secure),
    httpOnly: true,
    maxAge: opts.maxAgeMs,
  });
  // Readable by the SPA on purpose: double-submit CSRF needs JS to echo it in a header.
  res.cookie(CSRF_COOKIE, tokens.csrfToken, { ...baseOptions(opts.secure), httpOnly: false, maxAge: opts.maxAgeMs });
}

export function setCsrfCookie(res: Response, csrfToken: string, opts: { secure: boolean; maxAgeMs: number }): void {
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseOptions(opts.secure), httpOnly: false, maxAge: opts.maxAgeMs });
}

export function clearSessionCookies(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(secure), httpOnly: true });
  res.clearCookie(CSRF_COOKIE, baseOptions(secure));
}
