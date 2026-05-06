require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes')); 


mongoose.connect(process.env.DB_URL)
  .then(() => {
    console.log('Connesso al database!');
    app.listen(process.env.PORT || 3000, () => {
      console.log('Server avviato sulla porta 3000');
    });
  })
  .catch(err => console.error('Errore connessione:', err));
