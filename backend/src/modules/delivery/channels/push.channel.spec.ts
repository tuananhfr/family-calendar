import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { AppConfig } from '../../../config/configuration';
import { PushChannel } from './push.channel';
import type { WebPushTransport } from './web-push.transport';

function channel(vapid: AppConfig['vapid'], transport: WebPushTransport, ds: Partial<DataSource> = {}) {
  const config = { get: () => vapid } as unknown as ConfigService<AppConfig, true>;
  return new PushChannel(ds as DataSource, config, transport);
}

describe('PushChannel', () => {
  const ctx = {
    compose: () => ({ title: 't', body: 'b', tag: 'fc-1', data: { type: 'X', spaceId: 's', deliveryId: 'd' } }),
    urgent: false,
    isPrivate: false,
  };
  const target = { spaceId: 's', deviceId: 'd', actorId: 'a', memberId: null };

  it('reports UNSUPPORTED without VAPID keys and never calls the transport', async () => {
    const send = jest.fn();
    const push = channel({ publicKey: '', privateKey: '', subject: 'mailto:x@example.com' }, { send });
    expect(push.configured).toBe(false);
    await expect(push.send(target, ctx)).resolves.toBe('UNSUPPORTED');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports UNSUPPORTED for a device without a subscription', async () => {
    const send = jest.fn();
    const query = jest.fn().mockResolvedValue([]);
    const push = channel({ publicKey: 'p', privateKey: 'k', subject: 'mailto:x@example.com' }, { send }, { query });
    await expect(push.send(target, ctx)).resolves.toBe('UNSUPPORTED');
    expect(send).not.toHaveBeenCalled();
  });
});
