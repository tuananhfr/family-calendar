import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, type FileHandle } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

// Keys are built from server-validated UUIDs only; anything else is a bug, never a path to follow.
const KEY_PATTERN = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[0-9a-f-]{36}$/;

/** TEC-17 adapter: ciphertext files under STORAGE_DIR; no URL ever points at them. */
@Injectable()
export class LocalDiskStorage {
  private readonly root: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.root = resolve(config.get('storageDir', { infer: true }));
  }

  newKey(spaceId: string, fileId: string): string {
    return this.checked(`${spaceId}/${fileId}.${randomUUID()}`);
  }

  /** Uploads land here first so a failed or rejected upload never touches a live blob. */
  async tempPath(): Promise<string> {
    const dir = join(this.root, '.tmp');
    await mkdir(dir, { recursive: true });
    return join(dir, randomUUID());
  }

  async discard(tempPath: string): Promise<void> {
    await rm(tempPath, { force: true });
  }

  async commit(tempPath: string, key: string): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await rename(tempPath, target);
  }

  open(key: string): Promise<FileHandle> {
    return open(this.path(key), 'r');
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  private path(key: string): string {
    return join(this.root, this.checked(key));
  }

  private checked(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('invalid storage key');
    return key;
  }
}
