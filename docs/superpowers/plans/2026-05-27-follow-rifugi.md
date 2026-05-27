# Follow Rifugi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shelter follow/unfollow with site/email notification preferences and links opening animal cards on shelter pages.

**Architecture:** Store followed shelters on `User`, create dedicated follow APIs in `userController`, and emit `shelter_announcement` notifications from `announcementController` when approved shelters publish. Frontend consumes the APIs on shelter/profile pages.

**Tech Stack:** Node.js, Express, Mongoose, vanilla HTML/CSS/JS, nodemailer.

---

### Task 1: Backend Data And Follow APIs

**Files:**
- Modify: `backend/models/User.js`
- Modify: `backend/models/Notification.js`
- Modify: `backend/controllers/userController.js`
- Modify: `backend/routes/userRoutes.js`

- [ ] Add `followedShelters` to `User` with `shelterId`, `emailEnabled`, `createdAt`.
- [ ] Add `shelter_announcement`, `shelterId`, and `animalId` to `Notification`.
- [ ] Add `GET /api/v1/users/me/followed-shelters`.
- [ ] Add `POST /api/v1/users/me/followed-shelters/:shelterId`.
- [ ] Add `DELETE /api/v1/users/me/followed-shelters/:shelterId`.
- [ ] Run `node --check` on changed backend files.

### Task 2: Announcement Fanout

**Files:**
- Modify: `backend/controllers/announcementController.js`

- [ ] Add helper to build shelter animal URL.
- [ ] Add helper to send shelter announcement email.
- [ ] After approved shelter creates announcement, create site notifications for followers.
- [ ] Send email only to followers where `emailEnabled` is true.
- [ ] Run `node --check backend/controllers/announcementController.js`.

### Task 3: Shelter Page UI

**Files:**
- Modify: `frontend/pages/rifugio.html`
- Modify: `frontend/js/rifugio.js`
- Modify: `frontend/css/rifugio.css`

- [ ] Add follow button and preference popup.
- [ ] Fetch current follow state for logged-in users.
- [ ] Save follow with selected preference.
- [ ] Show "Non seguire più" when already following.
- [ ] Unfollow removes local state and stops future notifications.

### Task 4: Profile UI And Notifications

**Files:**
- Modify: `frontend/pages/profile.html`
- Modify: `frontend/js/profile.js`

- [ ] Add "Rifugi seguiti" section.
- [ ] Render followed shelters with "Apri pagina" and "Non seguire più".
- [ ] Refresh section after unfollow.
- [ ] Render `shelter_announcement` notifications with button to shelter page and animal card.

### Task 5: API Documentation And Cleanup

**Files:**
- Modify: `apiary.apib`

- [ ] Document follow endpoints.
- [ ] Run syntax checks.
- [ ] Remove test temp files or folders if any were created.
