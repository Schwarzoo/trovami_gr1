require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const path = require('path');

const app = express();

global.mockInbox = global.mockInbox || [];
const mockInboxEnabled = String(process.env.RENDER).toLowerCase() === 'true';


app.use(express.json());
app.use(cors());
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/announcements', require('./routes/announcementRoutes'));
app.use('/api/v1/animals', require('./routes/animalRoutes'));
app.use('/api/v1/users', require('./routes/userRoutes'));
app.use('/api/v1/notifications', require('./routes/notificationRoutes'));
app.use('/api/v1/contact-requests', require('./routes/contactRequestRoutes'));
app.use('/api/v1/admin', require('./routes/adminRoutes'));
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/api/v1/mock-emails', (req, res) => {
  if (!mockInboxEnabled) {
    return res.status(404).json({ message: 'Mock inbox non disponibile' });
  }

  return res.json(global.mockInbox);
});

app.use('/api', (req, res) => res.status(404).json({ message: 'Rotta API non trovata' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Errore interno del server' });
});

mongoose.connect(process.env.DB_URL)
  .then(() => {
    console.log('Connesso al database!');
    
    const port = process.env.PORT || 3000; 
    
    app.listen(port, () => {
      console.log(`Server avviato sulla porta ${port}`); 
    });
  })
  .catch(err => console.error('Errore connessione:', err));

