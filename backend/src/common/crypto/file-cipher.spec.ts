import { randomBytes } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { decryptStream, encryptStream, unwrapKey, wrapKey } from './file-cipher';

async function run(input: Buffer, transform: NodeJS.ReadWriteStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  await pipeline(
    Readable.from([input.subarray(0, 7), input.subarray(7)]),
    transform,
    new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(chunk);
        cb();
      },
    }),
  );
  return Buffer.concat(chunks);
}

describe('file cipher', () => {
  const aad = 'space-1/file-1';

  it('round-trips with AES-256-GCM and never emits the plaintext as ciphertext', async () => {
    const key = randomBytes(32);
    const plain = Buffer.from('Lịch khám răng của bé An, 9 giờ sáng thứ Bảy');
    const enc = encryptStream(key, aad);
    const sealed = await run(plain, enc.cipher);
    expect(enc.iv).toHaveLength(12);
    expect(sealed.includes(plain.subarray(0, 12))).toBe(false);

    const opened = await run(sealed, decryptStream(key, enc.iv, enc.getAuthTag(), aad));
    expect(opened.equals(plain)).toBe(true);
  });

  it('rejects a flipped ciphertext byte, a wrong tag and a different binding', async () => {
    const key = randomBytes(32);
    const enc = encryptStream(key, aad);
    const sealed = await run(randomBytes(4096), enc.cipher);
    const tag = enc.getAuthTag();

    const flipped = Buffer.from(sealed);
    flipped[100] ^= 1;
    await expect(run(flipped, decryptStream(key, enc.iv, tag, aad))).rejects.toThrow();
    await expect(run(sealed, decryptStream(key, enc.iv, randomBytes(16), aad))).rejects.toThrow();
    await expect(run(sealed, decryptStream(key, enc.iv, tag, 'space-1/file-2'))).rejects.toThrow();
  });

  it('wraps a per-file data key under the master key, bound to its record', () => {
    const master = randomBytes(32);
    const dataKey = randomBytes(32);
    const wrapped = wrapKey(master, dataKey, aad);
    expect(wrapped.includes(dataKey)).toBe(false);
    expect(unwrapKey(master, wrapped, aad).equals(dataKey)).toBe(true);
    expect(() => unwrapKey(randomBytes(32), wrapped, aad)).toThrow();
    expect(() => unwrapKey(master, wrapped, 'space-1/file-2')).toThrow();
  });
});
