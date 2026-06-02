require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const path = require('path');

const app = express();


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

mongoose.connect(process.env.DB_URL)
  .then(() => {
    console.log('Connesso al database!');
    
    const port = process.env.PORT || 3000; 
    
    app.listen(port, () => {
      console.log(`Server avviato sulla porta ${port}`); 
    });
  })
  .catch(err => console.error('Errore connessione:', err));

