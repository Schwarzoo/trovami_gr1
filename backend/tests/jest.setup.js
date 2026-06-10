const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

process.env.DB_URL ||= 'mongodb://127.0.0.1:27017/trovami_test';
process.env.JWT_SECRET ||= 'jest-jwt-secret';

const mockSendMail = jest.fn().mockResolvedValue(true);
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
  mockSendMail
}));
