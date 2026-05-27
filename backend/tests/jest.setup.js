const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

process.env.DB_URL ||= 'mongodb://127.0.0.1:27017/trovami_test';
process.env.JWT_SECRET ||= 'jest-jwt-secret';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue(true)
  }))
}));
