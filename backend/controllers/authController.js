const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { writeAuditLog } = require('../services/auditService');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendVerificationEmail(user, rawToken) {
  const transporter = createTransporter();
  const verifyUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${rawToken}`;

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Verifica Email - Trovami',
    html: `
      <h1>Trovami! - Verifica Email</h1>
      <p>Per attivare il tuo account, clicca il link qui sotto:</p>
      <a href="${verifyUrl}" style="background-color:#28a745;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">
        Verifica Email
      </a>
      <p>Questo link scade tra 24 ore.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

function duplicateAccountMessage(err) {
  if (err?.code !== 11000) return null;
  if (err.keyPattern?.email || err.keyValue?.email) return 'Email gia registrata';
  if (err.keyPattern?.username || err.keyValue?.username) return 'Nome utente gia in uso';
  return 'Account gia esistente';
}

function normalizeAccountRole(role) {
  return typeof role === 'string' ? role.toLowerCase() : role;
}

exports.register = async (req, res) => {
  try {
    const { username, email, password, phoneNumber, accountType, role, rifugioData } = req.body;
    const wantsRifugio = accountType === 'rifugio' || role === 'shelter';

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'Password deve avere almeno 8 caratteri' });
    }
    if (wantsRifugio && !rifugioData?.rifugioName) {
      return res.status(400).json({ message: 'Nome rifugio richiesto' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email già registrata' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      username,
      email,
      passwordHash,
      phoneNumber,
      role: wantsRifugio ? 'shelter' : 'user',
      rifugioStatus: wantsRifugio ? 'pending' : 'none',
      rifugioData: wantsRifugio ? {
        rifugioName: rifugioData.rifugioName,
        address: rifugioData.address || '',
        city: rifugioData.city || '',
        description: rifugioData.description || '',
        totalSlots: rifugioData.totalSlots || undefined,
        availableSlots: rifugioData.availableSlots || undefined
      } : undefined,
      isEmailVerified: false,
      emailVerificationToken: verifyTokenHash,
      emailVerificationExpires: verifyExpires
    });

    if (wantsRifugio) {
      const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
      await Promise.all(admins.map(admin => Notification.create({
        userId: admin._id,
        targetUserId: user._id,
        type: 'rifugio_request',
        message: `Nuova richiesta rifugio: ${rifugioData.rifugioName}`
      })));
    }
    await writeAuditLog({ actor: user, action: 'creato account', target: null });

    try {
      await sendVerificationEmail(user, verifyToken);
    } catch (mailErr) {
      return res.status(500).json({
        message: 'Account creato ma invio email di verifica fallito',
        error: mailErr.message,
        userId: user._id
      });
    }

    res.status(201).json({
      message: wantsRifugio
        ? 'Account rifugio creato. Controlla la mail e attendi approvazione admin'
        : 'Account creato. Controlla la mail per verificare l\'account',
      userId: user._id,
      role: user.role,
      rifugioStatus: user.rifugioStatus
    });
  } catch (err) {
    const duplicateMessage = duplicateAccountMessage(err);
    if (duplicateMessage) {
      return res.status(400).json({ message: duplicateMessage });
    }
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

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Account bloccato',
        blocked: true,
        userId: user._id,
        readmissionStatus: user.readmissionRequest?.status || 'none'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Email non verificata' });
    }

    user.role = normalizeAccountRole(user.role);

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

exports.requestReadmission = async (req, res) => {
  try {
    const { userId, email, message } = req.body;
    const text = String(message || '').trim();
    if (!text) return res.status(400).json({ message: 'Testo richiesta obbligatorio' });
    if (text.length > 1000) return res.status(400).json({ message: 'Testo troppo lungo (max 1000 caratteri)' });
    if (!userId && !email) return res.status(400).json({ message: 'Account richiesto' });

    const filter = userId ? { _id: userId } : { email };
    if (userId && !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'ID utente non valido' });
    }

    const user = await User.findOne(filter);
    if (!user) return res.status(404).json({ message: 'Account non trovato' });
    if (user.isActive) return res.status(400).json({ message: 'Account gia attivo' });

    user.readmissionRequest = {
      status: 'pending',
      message: text,
      requestedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null
    };
    await user.save();

    const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
    await Promise.all(admins.map(admin => Notification.create({
      userId: admin._id,
      targetUserId: user._id,
      type: 'admin_warning',
      message: `Richiesta di riammissione da ${user.username}`
    })));

    res.json({ message: 'Richiesta di riammissione inviata' });
  } catch (err) {
    res.status(500).json({ message: 'Errore richiesta riammissione', error: err.message });
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

    
    const transporter = createTransporter();

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

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ message: 'Token mancante' });
      }
      return res.redirect(`${baseUrl}/pages/verify-email.html?status=missing`);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(400).json({ message: 'Token non valido o scaduto' });
      }
      return res.redirect(`${baseUrl}/pages/verify-email.html?status=invalid`);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ message: 'Email verificata con successo' });
    }
    return res.redirect(`${baseUrl}/pages/verify-email.html?status=success`);
  } catch (err) {
    console.error('Verify email error:', err);
    const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || 'http://localhost:3000';
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ message: 'Errore server', error: err.message });
    }
    return res.redirect(`${baseUrl}/pages/verify-email.html?status=error`);
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

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email richiesta' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'Email non trovata' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ message: 'Email gia verificata' });
    }

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenHash = crypto.createHash('sha256').update(verifyToken).digest('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationToken = verifyTokenHash;
    user.emailVerificationExpires = verifyExpires;
    await user.save();

    await sendVerificationEmail(user, verifyToken);

    res.json({ message: 'Email di verifica reinviata' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: 'Errore server', error: err.message });
  }
};
