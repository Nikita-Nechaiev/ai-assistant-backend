import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.test';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASSWORD = 'pass';
    process.env.SMTP_FROM = '"Test" <noreply@test.com>';

    service = new EmailService();
  });

  it('calls nodemailer.sendMail with correct options', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: '1' });

    await service.sendMail('to@mail.com', 'Subj', 'txt', '<p>html</p>');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'to@mail.com',
        subject: 'Subj',
        text: 'txt',
        html: '<p>html</p>',
      }),
    );
  });

  it('re-throws as generic error when nodemailer fails', async () => {
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'));

    await expect(service.sendMail('a@b.c', 'S', 't', 'h')).rejects.toThrow('Email delivery failed');
  });

  it('delegates to sendMail with reset link', async () => {
    const spy = jest.spyOn(service, 'sendMail').mockResolvedValue(undefined as any);
    const link = 'https://host/reset/123';

    await service.sendResetPasswordEmail('u@mail.com', link);

    expect(spy).toHaveBeenCalledWith(
      'u@mail.com',
      'Reset Your Password',
      expect.any(String),
      expect.stringContaining(link),
    );
  });
});
