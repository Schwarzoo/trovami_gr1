const nodemailer = require('nodemailer');
const User = require('../models/User');

let transporter;

/**
 * Returns the singleton Nodemailer transporter configured from environment variables.
 * The transporter is created lazily so tests and boot code can set env vars first.
 * @returns {Object} Nodemailer transporter.
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

/**
 * Escapes HTML-sensitive characters before inserting text into markup.
 * @param {Object} value - Value to normalize or format.
 * @returns {string} Escaped HTML text.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns true when optional notification emails can be sent.
 * @returns {boolean} Whether SMTP credentials are configured.
 */
function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Sends an email-verification message containing the raw verification token link.
 * @param {Object} user - User receiving the verification email.
 * @param {string} rawToken - Raw verification token.
 * @returns {Promise<void>} Promise resolving when the email is sent.
 */
async function sendVerificationEmail(user, rawToken) {
  const verifyUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/v1/auth/email-verifications?token=${rawToken}`;

  await getTransporter().sendMail({
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
  });
}

/**
 * Sends a password-reset email containing the raw reset token link.
 * @param {string} email - Recipient email address.
 * @param {string} rawToken - Raw password reset token.
 * @returns {Promise<void>} Promise resolving when the email is sent.
 */
async function sendPasswordResetEmail(email, rawToken) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/reset-password.html?token=${rawToken}`;

  await getTransporter().sendMail({
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
  });
}

/**
 * Sends a smart-match email notification when email delivery is configured.
 * @param {string} userId - Recipient user id.
 * @param {string} subject - Email subject.
 * @param {string} html - Email HTML body.
 * @returns {Promise<void>} Promise resolving when the workflow completes.
 */
async function sendSmartMatchEmail(userId, subject, html) {
  try {
    const recipient = await User.findById(userId).select('email username');
    if (!recipient?.email || !isEmailConfigured()) return;

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject,
      html
    });
  } catch (err) {
    console.error('Errore invio email smart match:', err);
  }
}

/**
 * Sends an email to a shelter follower for a newly published shelter animal.
 * @param {Object} recipient - User following the shelter.
 * @param {Object} shelter - Shelter publishing the animal.
 * @param {Object} animal - Published animal.
 * @param {string} url - Frontend URL for the animal.
 * @returns {Promise<void>} Promise resolving when the workflow completes.
 */
async function sendShelterAnnouncementEmail(recipient, shelter, animal, url) {
  try {
    if (!recipient?.email || !isEmailConfigured()) return;

    const animalName = animal?.name || 'un nuovo animale';
    const breed = animal?.breed || 'Non specificata';
    const age = animal?.age || 'Non specificata';
    const shelterName = shelter?.rifugioData?.rifugioName || shelter?.username || 'un rifugio che segui';

    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient.email,
      subject: `Trovami - Nuovo annuncio da ${shelterName}`,
      html: `
        <p>Ciao ${escapeHtml(recipient.username || '')},</p>
        <p>${escapeHtml(shelterName)} ha pubblicato un nuovo annuncio.</p>
        <ul>
          <li><strong>Nome:</strong> ${escapeHtml(animalName)}</li>
          <li><strong>Età:</strong> ${escapeHtml(age)}</li>
          <li><strong>Razza:</strong> ${escapeHtml(breed)}</li>
        </ul>
        <p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#C85A2A;color:#ffffff;text-decoration:none;font-weight:700;">Apri scheda animale</a></p>
      `
    });
  } catch (err) {
    console.error('Errore invio email annuncio rifugio:', err);
  }
}

/**
 * Sends an email to an announcement publisher for a new comment.
 * @param {Object} publisher - Announcement publisher.
 * @param {string} commenterUsername - Username of the commenter.
 * @param {string} text - Comment text.
 * @param {string} announcementUrl - Frontend URL for the announcement.
 * @returns {Promise<void>} Promise resolving when the email is sent or skipped.
 */
async function sendAnnouncementCommentEmail(publisher, commenterUsername, text, announcementUrl) {
  if (!publisher?.notificationPrefs?.emailOnComment || !publisher?.email || !isEmailConfigured()) return;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: publisher.email,
    subject: 'Trovami - Nuovo commento',
    html: `
      <h2>Nuovo commento su un tuo annuncio</h2>
      <p><strong>${escapeHtml(commenterUsername)}</strong>: ${escapeHtml(text)}</p>
      <p><a href="${escapeHtml(announcementUrl)}">Vedi annuncio</a></p>
    `
  });
}

/**
 * Sends an account-blocked email when delivery is configured.
 * @param {Object} user - Blocked user.
 * @param {string} reason - Admin-provided block reason.
 * @returns {Promise<void>} Promise resolving when the email is sent or skipped.
 */
async function sendAccountBlockedEmail(user, reason) {
  if (!user?.email || !isEmailConfigured()) return;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject: 'Account bloccato - Trovami',
    html: `
      <h2>Account bloccato</h2>
      <p>Il tuo account Trovami e stato bloccato da un admin.</p>
      <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
    `
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendSmartMatchEmail,
  sendMatchEmail: sendSmartMatchEmail,
  sendShelterAnnouncementEmail,
  sendAnnouncementCommentEmail,
  sendAccountBlockedEmail
};
