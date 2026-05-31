describe('emailService', () => {
  let nodemailer;
  let sendMail;
  let emailService;

  beforeEach(() => {
    jest.resetModules();
    nodemailer = require('nodemailer');
    sendMail = jest.fn().mockResolvedValue(true);
    nodemailer.createTransport.mockReturnValue({ sendMail });

    process.env.SMTP_HOST = 'smtp.test.local';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_USER = 'smtp-user@test.local';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.SMTP_FROM = 'from@test.local';
    process.env.BACKEND_URL = 'http://backend.test';
    process.env.FRONTEND_URL = 'http://frontend.test';

    emailService = require('../services/emailService');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('reuses one nodemailer transporter across email workflows', async () => {
    await emailService.sendVerificationEmail({ email: 'user@test.local' }, 'verify-token');
    await emailService.sendPasswordResetEmail('user@test.local', 'reset-token');

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  test('sends verification email with verification link', async () => {
    await emailService.sendVerificationEmail({ email: 'user@test.local' }, 'verify-token');

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'from@test.local',
      to: 'user@test.local',
      subject: 'Verifica Email - Trovami',
      html: expect.stringContaining('http://backend.test/api/v1/auth/email-verifications?token=verify-token')
    }));
  });

  test('does not send optional notifications when SMTP credentials are missing', async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    await emailService.sendAccountBlockedEmail({ email: 'user@test.local' }, 'motivo');

    expect(sendMail).not.toHaveBeenCalled();
  });
});
