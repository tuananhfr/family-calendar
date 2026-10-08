import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import { EmailChannel } from './email.channel';
describe('SMTP delivery result', () => {
  function channel() {
    const config = new ConfigService({ mail: { transport: 'smtp', smtpUrl: 'smtp://127.0.0.1:2525',
      dir: 'var/test-mail', from: 'Lich Gia Dinh <no-reply@example.com>' } }) as ConfigService<AppConfig, true>;
    const service = new EmailChannel(config);
    const transport = (service as unknown as { transport: { sendMail: (message: unknown) => Promise<unknown> } }).transport;
    return { service, transport };
  }
  it('uses the configured sender and reports success only when SMTP accepts a recipient', async () => {
    const { service, transport } = channel();
    const send = jest.spyOn(transport, 'sendMail').mockResolvedValue({ accepted: ['owner@example.com'], rejected: [] });
    await expect(service.send({ to: 'owner@example.com', subject: 'Test', text: 'Test' })).resolves.toEqual({});
    expect(send).toHaveBeenCalledWith({ from: 'Lich Gia Dinh <no-reply@example.com>', to: 'owner@example.com', subject: 'Test', text: 'Test' });
  });
  it('does not report a message with no accepted recipient as sent', async () => {
    const { service, transport } = channel();
    jest.spyOn(transport, 'sendMail').mockResolvedValue({ accepted: [], rejected: ['owner@example.com'] });
    await expect(service.send({ to: 'owner@example.com', subject: 'Test', text: 'Test' })).rejects.toThrow('SMTP_RECIPIENT_REJECTED');
  });
});
