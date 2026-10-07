import { createCipheriv, createDecipheriv, randomBytes, type CipherGCM, type DecipherGCM } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const DATA_KEY_BYTES = 32;

export function newDataKey(): Buffer {
  return randomBytes(DATA_KEY_BYTES);
}

/**
 * Streams AES-256-GCM under a per-file data key. `aad` binds the ciphertext to its record (space/file id), so a blob
 * moved onto another record fails authentication. The tag exists only after the cipher has flushed.
 */
export function encryptStream(key: Buffer, aad: string): { iv: Buffer; cipher: CipherGCM; getAuthTag(): Buffer } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  return { iv, cipher, getAuthTag: () => cipher.getAuthTag() };
}

/**
 * GCM checks the tag only at the end, after plaintext has already been emitted: a caller must not hand that output
 * to anyone until the stream finished without error.
 */
export function decryptStream(key: Buffer, iv: Buffer, tag: Buffer, aad: string): DecipherGCM {
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return decipher;
}

/** iv ‖ tag ‖ ciphertext of the data key under the master key. */
export function wrapKey(master: Buffer, dataKey: Buffer, aad: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, master, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const sealed = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), sealed]);
}

export function unwrapKey(master: Buffer, wrapped: Buffer, aad: string): Buffer {
  const iv = wrapped.subarray(0, IV_BYTES);
  const tag = wrapped.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, master, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
}
