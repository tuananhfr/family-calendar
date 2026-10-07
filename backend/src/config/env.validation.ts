import { plainToInstance } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { Type } from 'class-transformer';

export class EnvironmentVariables {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(65535) PORT?: number;
  @IsOptional() @IsString() HOST?: string;
  @IsOptional() @IsString() API_ORIGIN?: string;
  @IsOptional() @IsString() FRONTEND_ORIGIN?: string;
  @IsOptional()
  @Matches(/^(\/[a-zA-Z0-9_-]+)*\/?$/, {
    message: 'PUBLIC_BASE_PATH must be empty or an absolute path like /lich-gia-dinh',
  })
  PUBLIC_BASE_PATH?: string;

  @IsString() @IsNotEmpty() DB_HOST: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) DB_PORT: number;
  @IsString() @IsNotEmpty() DB_USER: string;
  // Must be declared even when empty so a missing .env line is not mistaken for "no password".
  @IsDefined() @IsString() DB_PASSWORD: string;
  @IsString() @IsNotEmpty() DB_NAME: string;

  @IsOptional() @IsIn(['true', 'false']) COOKIE_SECURE?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) SESSION_TTL_DAYS?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) RATE_LIMIT_SCALE?: number;

  @IsOptional() @IsString() STORAGE_DIR?: string;
  @Matches(/^[0-9a-fA-F]{64}$/, { message: 'STORAGE_MASTER_KEY must be 64 hex chars (run node scripts/gen-keys.mjs)' })
  STORAGE_MASTER_KEY: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) STORAGE_MAX_FILE_BYTES?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) STORAGE_MAX_VIDEO_BYTES?: number;

  @IsOptional() @IsString() VAPID_PUBLIC_KEY?: string;
  @IsOptional() @IsString() VAPID_PRIVATE_KEY?: string;
  @IsOptional() @IsString() VAPID_SUBJECT?: string;

  @IsOptional() @IsIn(['file', 'smtp']) MAIL_TRANSPORT?: string;
  @IsOptional() @IsString() MAIL_DIR?: string;
  @IsOptional() @IsString() SMTP_URL?: string;

  @IsOptional() @IsString() ANTHROPIC_API_KEY?: string;
  @IsOptional() @IsString() AI_MODEL?: string;
  @IsOptional() @IsIn(['anthropic', 'fake']) AI_PROVIDER?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) AI_RETENTION_DAYS?: number;

  @IsOptional() @IsIn(['true', 'false']) RUN_WORKER_IN_PROCESS?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) SYNC_TOMBSTONE_DAYS?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) SYNC_SNAPSHOT_MAX_RECORDS?: number;
}

export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const instance = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: false });
  const errors = validateSync(instance, { skipMissingProperties: false, whitelist: false });
  if (errors.length > 0) {
    const detail = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`).join('; ');
    throw new Error(`Invalid environment configuration: ${detail}`);
  }
  return raw;
}
