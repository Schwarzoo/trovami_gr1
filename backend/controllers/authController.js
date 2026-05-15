const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

exports.register = async (req, res) => {
  try {
    const { username, email, password, phoneNumber } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password deve avere almeno 8 caratteri' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email già registrata' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({ username, email, passwordHash, phoneNumber });

    res.status(201).json({ message: 'Account creato con successo', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account bloccato' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.sessionToken = token;
    await user.save();

    res.json({ message: 'Login effettuato', token, role: user.role });
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, { sessionToken: null });
    res.json({ message: 'Logout effettuato' });
  } catch (err) {
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email richiesta' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email non trovata' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); 

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/reset-password.html?token=${resetToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Recupero Password - Trovami',
      html: `
        <h1>Trovami! - Recupero Password</h1>
        <h2>Hai richiesto il recupero della password</h2>
        <p>Clicca il link qui sotto per impostare una nuova password:</p>
        <a href="${resetUrl}" style="background-color:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">
          Reimposta Password
        </a>
        <p>Questo link scade tra 15 minuti.</p>
        <p>Se non hai richiesto il recupero della password, ignora questo email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'Email di recupero inviata' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token e password richiesti' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password deve avere almeno 8 caratteri' });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token non valido o scaduto' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.sessionToken = null; 
    await user.save();

    res.json({ message: 'Password aggiornata con successo' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};