const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'profile.js'), 'utf8');
const renderAdminReports = source.slice(
  source.indexOf('function renderAdminReports'),
  source.indexOf('function renderPendingRifugi')
);
const adminClickHandler = source.slice(
  source.indexOf("document.getElementById('admin-section')?.addEventListener('click'"),
  source.indexOf("document.getElementById('showCreate')")
);
const renderNotifications = source.slice(
  source.indexOf('function renderNotifications'),
  source.indexOf('function renderRifugioStatus')
);
const adminController = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'controllers', 'adminController.js'), 'utf8');
const adminRoutes = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'routes', 'adminRoutes.js'), 'utf8');
const authController = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'controllers', 'authController.js'), 'utf8');
const authRoutes = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'routes', 'authRoutes.js'), 'utf8');
const announcementController = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'controllers', 'announcementController.js'), 'utf8');
const userModel = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'models', 'User.js'), 'utf8');
const auditLogModel = fs.readFileSync(path.join(__dirname, '..', '..', 'backend', 'models', 'AuditLog.js'), 'utf8');
const loginSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'login.js'), 'utf8');
const readmissionPage = fs.readFileSync(path.join(__dirname, '..', 'pages', 'readmission.html'), 'utf8');
const userAnnouncementsPage = fs.readFileSync(path.join(__dirname, '..', 'pages', 'user-announcements.html'), 'utf8');
const userAnnouncementsSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'user-announcements.js'), 'utf8');
const profilePage = fs.readFileSync(path.join(__dirname, '..', 'pages', 'profile.html'), 'utf8');

test('admin report view opens announcement modal from profile page', () => {
  assert.match(renderAdminReports, /data-admin-action="view-ann"/);
  assert.doesNotMatch(renderAdminReports, /href="\/pages\/announcements\.html\?highlight=/);
});

test('admin report view and archive buttons use orange style', () => {
  assert.match(renderAdminReports, /btn btn--orange" data-admin-action="view-ann"/);
  assert.match(renderAdminReports, /btn btn--orange" data-admin-action="dismiss-report"/);
  assert.match(renderAdminReports, />Vedi annuncio<\/button>/);
});

test('admin announcement popup uses announcements modal structure', () => {
  assert.match(source, /getElementById\('admin-modal-gallery'\)/);
  assert.match(source, /class="detail-list"/);
  assert.match(source, /class="modal-description"/);
  assert.doesNotMatch(source, /class="admin-announcement-details"/);
});

test('canceling delete announcement does not delete or archive report', () => {
  assert.match(adminClickHandler, /if \(reason === null\) return;/);
  assert.doesNotMatch(adminClickHandler, /const reason = prompt\('Motivo rimozione annuncio:', 'annuncio falso\/offensivo'\) \|\|/);
});

test('deleted announcement notification message includes reason and no announcement link is rendered', () => {
  assert.match(adminController, /message: `Annuncio eliminato, motivo: \$\{reason\}`/);
  assert.doesNotMatch(adminController, /message: `Un tuo annuncio e' stato rimosso:/);
  assert.match(renderNotifications, /const isDeletedAnnouncementNotification = /);
  assert.match(renderNotifications, /!isDeletedAnnouncementNotification && !isReportNotification && annId/);
});

test('admin report notifications do not show duplicate announcement link', () => {
  assert.match(renderNotifications, /const isReportNotification = n\?\.type === 'report'/);
  assert.match(renderNotifications, /!isDeletedAnnouncementNotification && !isReportNotification && annId/);
});

test('admin reports show account details instead of block or warning action', () => {
  assert.match(renderAdminReports, /data-admin-action="view-user"/);
  assert.match(renderAdminReports, /btn btn--orange" data-admin-action="view-user"/);
  assert.match(renderAdminReports, />Visualizza account<\/button>/);
  assert.doesNotMatch(renderAdminReports, /data-admin-action="warn-user"/);
  assert.doesNotMatch(renderAdminReports, />Avverti<\/button>/);
  assert.doesNotMatch(renderAdminReports, /data-admin-action="block-user"/);
});

test('admin warning is persisted and sends conduct notification', () => {
  assert.match(userModel, /conductWarnings:/);
  assert.match(adminRoutes, /router\.patch\('\/users\/:id\/warn', warnUser\)/);
  assert.match(adminController, /exports\.warnUser = async/);
  assert.match(adminController, /\$push:\s*\{\s*conductWarnings:/);
  assert.match(adminController, /Hai ricevuto un ammonimento sulla condotta dell'account/);
  assert.match(adminController, /al prossimo ammonimento ci sara il blocco dell'account/);
  assert.match(source, /class="admin-warning-count"/);
  assert.match(source, /data-admin-action="warn-user"/);
  assert.match(source, />Avverti<\/button>/);
  assert.match(source, /async function warnAdminUser/);
  assert.match(source, /renderAdminUserModal\(warnedUser\)/);
});

test('account popup can block user with prompted reason sent by email', () => {
  assert.match(source, /data-admin-action="block-user"/);
  assert.match(source, />Blocca account<\/button>/);
  assert.match(source, /async function blockAdminUser/);
  assert.match(source, /prompt\('Motivo blocco account:'/);
  assert.match(source, /if \(reason === null\) return;/);
  assert.match(adminController, /const nodemailer = require\('nodemailer'\)/);
  assert.match(adminController, /async function sendAccountBlockedEmail/);
  assert.match(adminController, /await transporter\.sendMail/);
  assert.match(adminController, /Account bloccato - Trovami/);
  assert.match(adminController, /Motivo:/);
  assert.match(adminController, /await sendAccountBlockedEmail\(user, reason\)/);
});

test('account popup closes after successful account block', () => {
  const blockAdminUser = source.slice(
    source.indexOf('async function blockAdminUser'),
    source.indexOf('function renderAdminAnnouncementModal')
  );
  assert.match(blockAdminUser, /if \(!res\.ok\) throw new Error/);
  assert.match(blockAdminUser, /closeAdminUserModal\(\)/);
});

test('blocking an account removes its announcements and marks related reports reviewed', () => {
  assert.match(adminController, /Announcement\.find\(\{ publisherId: userId \}\)\.select\('_id'\)/);
  assert.match(adminController, /Promise\.all\(announcementIds\.map\(announcementId => removeAnnouncementCascade\(announcementId\)\)\)/);
  assert.match(adminController, /Report\.updateMany\(\{ announcementId: \{ \$in: announcementIds \} \}, \{ \$set: \{ status: 'REVIEWED' \} \}\)/);
  assert.match(adminController, /removedAnnouncementsCount = announcementIds\.length/);
  assert.match(adminController, /reviewedReportsCount = reviewedReports\.modifiedCount \|\| 0/);
  assert.match(source, /if \(button\.dataset\.adminAction === 'block-user'\) \{[\s\S]*await blockAdminUser\(button\.dataset\.userId\);[\s\S]*await loadAdminData\(\);/);
  assert.match(source, /await loadMyAnnouncements\(\);/);
  assert.match(userAnnouncementsSource, /await loadUserAnnouncements\(\);/);
});

test('blocking an account clears warnings and handled admin report notifications', () => {
  assert.match(adminController, /conductWarnings:\s*\[\]/);
  assert.match(adminController, /Notification\.updateMany\(/);
  assert.match(adminController, /type:\s*'report'/);
  assert.match(adminController, /isRead:\s*true/);
});

test('account popup shows published announcement count instead of creation date and compact actions', () => {
  assert.match(adminController, /publishedAnnouncementsCount/);
  assert.match(adminController, /async function getPublishedAnnouncementsCount\(userId\)/);
  assert.match(adminController, /Announcement\.countDocuments\(\{ publisherId: userId \}\)/);
  assert.match(adminController, /exports\.getUserAnnouncementCount = async/);
  assert.match(adminController, /res\.json\(\{ publishedAnnouncementsCount: await getPublishedAnnouncementsCount\(userId\) \}\)/);
  assert.match(adminController, /async function withPublishedAnnouncementsCount/);
  assert.match(adminController, /exports\.getUserDetails = async/);
  assert.match(adminRoutes, /getUserAnnouncementCount/);
  assert.match(adminRoutes, /router\.get\('\/users\/:id\/announcement-count', getUserAnnouncementCount\)/);
  assert.match(adminRoutes, /router\.get\('\/users\/:id', getUserDetails\)/);
  assert.match(source, /async function fetchAdminUser/);
  assert.match(source, /api\/admin\/users\/\$\{encodeURIComponent\(userId\)\}/);
  assert.match(source, /async function fetchAdminUserAnnouncementCount/);
  assert.match(source, /api\/admin\/users\/\$\{encodeURIComponent\(userId\)\}\/announcement-count/);
  assert.match(source, /async function openAdminUserModal/);
  assert.match(source, /await openAdminUserModal\(button\.dataset\.userId\)/);
  assert.match(source, /<dt>Annunci pubblicati<\/dt><dd>\$\{Number\(user\?\.publishedAnnouncementsCount \|\| 0\)\}<\/dd>/);
  assert.match(source, /\/pages\/user-announcements\.html\?userId=\$\{encodeURIComponent\(user\?\._id \|\| ''\)\}/);
  assert.match(source, />Mostra annunci<\/a>/);
  assert.doesNotMatch(source, /<dt>Creato il<\/dt>/);
  assert.doesNotMatch(source, /<dt>Ruolo<\/dt>/);
  assert.doesNotMatch(source, /<dt>Stato<\/dt>/);
  assert.match(source, /class="btn btn--orange btn--compact"/);
  assert.match(source, /class="btn btn--danger btn--compact"/);
});

test('account popup refreshes details count before falling back to cached report publisher', () => {
  assert.match(source, /let user = adminUserLookup\.get\(key\);[\s\S]*const freshUser = await fetchAdminUser\(userId\);/);
  assert.match(source, /adminUserLookup\.set\(String\(freshUser\?\._id \|\| userId\), freshUser\);/);
  assert.match(source, /catch \(err\) \{[\s\S]*if \(!user\) throw err;/);
});

test('admin moderation errors include response status when backend route is unavailable', () => {
  assert.match(source, /async function readResponseError\(res, fallback\)/);
  assert.match(source, /return `\$\{fallback\} \(\$\{res\.status\}\)`/);
  assert.match(source, /throw new Error\(await readResponseError\(res, 'Errore ammonimento'\)\)/);
});

test('dedicated user announcements page filters by selected user', () => {
  assert.match(userAnnouncementsPage, /user-announcements\.js/);
  assert.match(userAnnouncementsSource, /userId=\$\{encodeURIComponent\(userId\)\}&status=all/);
  assert.match(userAnnouncementsSource, /`Annunci di: \$\{user\}`/);
  assert.match(announcementController, /const \{ type, species, status, rifugioId, userId \} = req\.query/);
  assert.match(announcementController, /filter\.publisherId = userId/);
  assert.match(announcementController, /if \(status !== 'all'\) filter\.status = status \|\| 'ACTIVE'/);
});

test('dedicated user announcements page has admin warning and block actions beside title', () => {
  assert.match(userAnnouncementsPage, /id="warn-user"/);
  assert.match(userAnnouncementsPage, /class="user-action-btn user-action-btn--warn"/);
  assert.match(userAnnouncementsPage, />Avverti<\/button>/);
  assert.match(userAnnouncementsPage, /id="block-user"/);
  assert.match(userAnnouncementsPage, /class="user-action-btn user-action-btn--block"/);
  assert.match(userAnnouncementsPage, />Blocca account<\/button>/);
  assert.match(userAnnouncementsSource, /function setupAdminActions\(userId\)/);
  assert.match(userAnnouncementsSource, /async function warnUser\(userId\)/);
  assert.match(userAnnouncementsSource, /prompt\('Motivo avvertimento:'/);
  assert.match(userAnnouncementsSource, /\/users\/\$\{encodeURIComponent\(userId\)\}\/warn/);
  assert.match(userAnnouncementsSource, /async function blockUser\(userId\)/);
  assert.match(userAnnouncementsSource, /prompt\('Motivo blocco account:'/);
  assert.match(userAnnouncementsSource, /\/users\/\$\{encodeURIComponent\(userId\)\}\/block/);
});

test('dedicated user announcements page opens read-only modal with details and comments', () => {
  assert.match(userAnnouncementsPage, /id="modal-overlay"/);
  assert.match(userAnnouncementsSource, /async function fetchAnnouncementById/);
  assert.match(userAnnouncementsSource, /function openModal\(ann\)/);
  assert.match(userAnnouncementsSource, /card\.addEventListener\('click', \(\) => openModal\(ann\)\)/);
  assert.match(userAnnouncementsSource, /class="detail-list"/);
  assert.match(userAnnouncementsSource, /class="comments-section"/);
  assert.match(userAnnouncementsSource, /renderCommentsHtml\(comments\)/);
  assert.doesNotMatch(userAnnouncementsSource, /class="comment-form"/);
  assert.doesNotMatch(userAnnouncementsSource, /postAnnouncementComment/);
});

test('blocked login redirects to readmission request page and needs admin approval', () => {
  assert.match(userModel, /readmissionRequest:/);
  assert.match(authController, /blocked: true/);
  assert.match(authController, /readmissionStatus: user\.readmissionRequest\?\.status \|\| 'none'/);
  assert.match(authRoutes, /router\.post\('\/readmission-request', requestReadmission\)/);
  assert.match(authController, /exports\.requestReadmission = async/);
  assert.match(authController, /'readmissionRequest\.status': 'pending'|status: 'pending'/);
  assert.match(loginSource, /readmission\.html\?userId=/);
  assert.match(readmissionPage, /id="readmissionForm"/);
  assert.match(adminRoutes, /router\.get\('\/readmission-requests', getPendingReadmissionRequests\)/);
  assert.match(adminRoutes, /router\.patch\('\/users\/:id\/readmission\/:action', reviewReadmissionRequest\)/);
  assert.match(adminController, /exports\.getPendingReadmissionRequests = async/);
  assert.match(adminController, /exports\.reviewReadmissionRequest = async/);
  assert.match(adminController, /update\.isActive = true/);
  assert.match(profilePage, /admin-readmissions-list/);
  assert.match(source, /fetchPendingReadmissions/);
  assert.match(source, /data-admin-action="approve-readmission"/);
});

test('readmission review audit actions are valid audit log enum values', () => {
  assert.match(adminController, /APPROVE_READMISSION/);
  assert.match(adminController, /REJECT_READMISSION/);
  assert.match(auditLogModel, /APPROVE_READMISSION/);
  assert.match(auditLogModel, /REJECT_READMISSION/);
});

test('readmission review returns success even if notification or audit side effects fail', () => {
  const reviewReadmission = adminController.slice(
    adminController.indexOf('exports.reviewReadmissionRequest = async'),
    adminController.indexOf('exports.warnUser = async')
  );
  assert.match(reviewReadmission, /try\s*\{[\s\S]*await Notification\.create/);
  assert.match(reviewReadmission, /try\s*\{[\s\S]*await writeAudit/);
  assert.match(reviewReadmission, /console\.warn\('Errore side effect riammissione:/);
  assert.match(reviewReadmission, /res\.json\(user\)/);
});
