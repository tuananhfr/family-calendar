import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'fc_sid';
export const CSRF_COOKIE = 'fc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** `path` is the public base path plus "/", so a sub-path deploy does not leak cookies to sibling apps on the domain. */
export interface CookieScope {
  secure: boolean;
  path: string;
}

function baseOptions(scope: CookieScope): CookieOptions {
  return { sameSite: 'lax', secure: scope.secure, path: scope.path };
}

export function setSessionCookies(
  res: Response,
  tokens: { sessionToken: string; csrfToken: string },
  opts: CookieScope & { maxAgeMs: number },
): void {
  res.cookie(SESSION_COOKIE, tokens.sessionToken, {
    ...baseOptions(opts),
    httpOnly: true,
    maxAge: opts.maxAgeMs,
  });
  // Readable by the SPA on purpose: double-submit CSRF needs JS to echo it in a header.
  res.cookie(CSRF_COOKIE, tokens.csrfToken, { ...baseOptions(opts), httpOnly: false, maxAge: opts.maxAgeMs });
}

export function setCsrfCookie(res: Response, csrfToken: string, opts: CookieScope & { maxAgeMs: number }): void {
  res.cookie(CSRF_COOKIE, csrfToken, { ...baseOptions(opts), httpOnly: false, maxAge: opts.maxAgeMs });
}

export function clearSessionCookies(res: Response, scope: CookieScope): void {
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(scope), httpOnly: true });
  res.clearCookie(CSRF_COOKIE, baseOptions(scope));
}
