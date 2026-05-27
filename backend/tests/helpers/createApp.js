const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  app.use('/api/v1/auth', require('../../routes/authRoutes'));
  app.use('/api/v1/announcements', require('../../routes/announcementRoutes'));
  app.use('/api/v1/animals', require('../../routes/animalRoutes'));
  app.use('/api/v1/users', require('../../routes/userRoutes'));
  app.use('/api/v1/notifications', require('../../routes/notificationRoutes'));
  app.use('/api/v1/contact-requests', require('../../routes/contactRequestRoutes'));
  app.use('/api/v1/admin', require('../../routes/adminRoutes'));

  return app;
}

module.exports = { createApp };

