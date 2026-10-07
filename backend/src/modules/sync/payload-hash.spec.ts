import { canonicalJson, payloadHash } from './payload-hash';

const op = {
  operation_id: '11111111-1111-4111-8111-111111111111',
  resource_type: 'item',
  resource_id: '22222222-2222-4222-8222-222222222222',
  action: 'update' as const,
  base_revision: '3',
  payload: { b: 1, a: { d: [3, { y: 1, x: 2 }], c: 'Bà Nội 🎂' } },
  client_created_at: '2026-10-07T01:00:00.000Z',
  schema_version: 1 as const,
};

describe('payloadHash', () => {
  it('is a lowercase sha256 hex string', () => {
    expect(payloadHash(op)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ignores key order at every depth', () => {
    const reordered = { ...op, payload: { a: { c: 'Bà Nội 🎂', d: [3, { x: 2, y: 1 }] }, b: 1 } };
    expect(payloadHash(reordered)).toBe(payloadHash(op));
  });

  it('ignores operation id, client timestamp and schema version', () => {
    const retried = { ...op, operation_id: 'x', client_created_at: '2030-01-01T00:00:00.000Z' };
    expect(payloadHash(retried)).toBe(payloadHash(op));
  });

  it('changes when any hashed field or array order changes', () => {
    const variants = [
      { ...op, resource_type: 'member' },
      { ...op, resource_id: '33333333-3333-4333-8333-333333333333' },
      { ...op, action: 'delete' as const },
      { ...op, base_revision: null },
      { ...op, payload: { ...op.payload, b: 2 } },
      { ...op, payload: { ...op.payload, a: { ...op.payload.a, d: [{ y: 1, x: 2 }, 3] } } },
    ];
    const hashes = new Set(variants.map((v) => payloadHash(v)));
    expect(hashes.size).toBe(variants.length);
    expect(hashes.has(payloadHash(op))).toBe(false);
  });

  it('serializes canonically and drops undefined values like JSON does', () => {
    expect(canonicalJson({ b: [1, undefined], a: undefined, c: null })).toBe('{"b":[1,null],"c":null}');
  });
});
