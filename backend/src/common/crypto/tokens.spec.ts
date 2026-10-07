import { newOpaqueToken, safeEqual, sha256Hex } from './tokens';

describe('tokens', () => {
  it('newOpaqueToken returns 32 random bytes as base64url', () => {
    const t = newOpaqueToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
  });

  it('newOpaqueToken does not repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(newOpaqueToken());
    expect(seen.size).toBe(5000);
  });

  it('sha256Hex matches the standard test vector for strings and buffers', () => {
    const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
    expect(sha256Hex('abc')).toBe(abc);
    expect(sha256Hex(Buffer.from('abc'))).toBe(abc);
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('safeEqual compares without throwing on length mismatch', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
  });
});
