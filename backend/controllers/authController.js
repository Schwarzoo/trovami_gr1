const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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