const fs = require('fs');
const path = require('path');

describe('shared announcement card frontend', () => {
  test('home and announcements use the shared card and modal helpers', () => {
    const includes = fs.readFileSync(path.join(__dirname, '../../frontend/js/includes.js'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, '../../frontend/js/home.js'), 'utf8');
    const announcements = fs.readFileSync(path.join(__dirname, '../../frontend/js/announcements.js'), 'utf8');

    expect(includes).toContain('function createAnnouncementCard');
    expect(includes).toContain('async function openAnnouncementModal');
    expect(includes).toContain('function closeAnnouncementModal');

    expect(home).toContain('createAnnouncementCard(ann');
    expect(home).toContain('closeAnnouncementModal()');
    expect(home).not.toContain('function buildHomeCard');
    expect(home).not.toContain('async function openHomeModal');

    expect(announcements).toContain('createAnnouncementCard(ann');
    expect(announcements).toContain('closeAnnouncementModal()');
    expect(announcements).not.toContain('function buildCard');
    expect(announcements).not.toContain('async function openModal');
  });

  test('shelter announcements do not render resolve actions', () => {
    const includes = fs.readFileSync(path.join(__dirname, '../../frontend/js/includes.js'), 'utf8');
    const profileAnnouncementForm = fs.readFileSync(path.join(__dirname, '../../frontend/js/profile-announcement-form.js'), 'utf8');
    const profileShelter = fs.readFileSync(path.join(__dirname, '../../frontend/js/profile-shelter.js'), 'utf8');

    expect(includes).toContain('function isShelterAnnouncement');
    expect(includes).toContain("currentRole === 'admin' && !isShelterAnnouncement(data)");
    expect(profileAnnouncementForm).toContain('function isShelterAnnouncement');
    expect(profileShelter).toContain("a.status !== 'RESOLVED' && !isShelterAnnouncement(a)");
  });

  test('profile split exposes shelter position editor to the main profile script', () => {
    const profile = fs.readFileSync(path.join(__dirname, '../../frontend/js/profile.js'), 'utf8');
    const profileShelter = fs.readFileSync(path.join(__dirname, '../../frontend/js/profile-shelter.js'), 'utf8');

    expect(profile).toContain('let openRifugioPositionEditor = () => {}');
    expect(profile).toContain('openRifugioPositionEditor = shelterModule.openRifugioPositionEditor');
    expect(profileShelter).toContain('function openRifugioPositionEditor()');
    expect(profileShelter).toContain('openRifugioPositionEditor,');
  });
});
