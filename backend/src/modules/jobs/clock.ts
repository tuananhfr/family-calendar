import { Injectable } from '@nestjs/common';

/** Injected wherever time decides behaviour, so tests can stop and move it. */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol('CLOCK');

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
