const HOME_MAX_CARDS = 6;
const HOME_RESOLVED_API = '/api/v1/announcements/count?status=resolved';
const HOME_ACTIVE_API = '/api/v1/announcements/count?status=active';
const HOME_PUBLIC_RIFUGI_API = '/api/v1/users/shelters?isPublic=true';

/**
 * Fetches public rifugi count data from the API.
 * @returns {Promise<number>} Number of public shelters returned by the API, or 0 on failure.
 */
async function fetchPublicRifugiCount() {
  try {
    const res = await fetch(HOME_PUBLIC_RIFUGI_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Array.isArray(json) ? json.length : 0;
  } catch (err) {
    console.error('Errore fetch rifugi pubblici', err);
    return 0;
  }
}

/**
 * Fetches resolved announcements count data from the API.
 * @returns {Promise<number>} Total resolved-announcement count, or 0 on failure.
 */
async function fetchResolvedAnnouncementsCount() {
  try {
    const res = await fetch(HOME_RESOLVED_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Number(json?.count ?? json?.resolvedCount ?? 0);
  } catch (err) {
    console.error('Errore fetch annunci risolti', err);
    return 0;
  }
}

/**
 * Fetches active announcements count data from the API.
 * @returns {Promise<number>} Total active-announcement count, or 0 on failure.
 */
async function fetchActiveAnnouncementsCount() {
  try {
    const res = await fetch(HOME_ACTIVE_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return Number(json?.count ?? 0);
  } catch (err) {
    console.error('Errore fetch annunci attivi', err);
    return 0;
  }
}

/**
 * Renders hero stats into the current page.
 * @returns {Promise<void>} Promise resolving after hero counters are refreshed.
 */
async function renderHeroStats() {
  const resolvedCounter = document.getElementById('resolved-announcements-count');
  const activeCounter = document.getElementById('active-announcements-count');
  const rifugiCounter = document.getElementById('public-rifugi-count');
  if (!resolvedCounter && !activeCounter && !rifugiCounter) return;

  const [activeCount, resolvedCount, rifugiCount] = await Promise.all([
    fetchActiveAnnouncementsCount(),
    fetchResolvedAnnouncementsCount(),
    fetchPublicRifugiCount()
  ]);

  if (resolvedCounter) resolvedCounter.textContent = String(resolvedCount);
  if (activeCounter) activeCounter.textContent = String(activeCount);
  if (rifugiCounter) rifugiCounter.textContent = String(rifugiCount);
}

/**
 * Renders impact-card stats into the current page.
 * @returns {Promise<void>} Promise resolving after the impact counters are refreshed.
 */
async function renderHomeImpactStats() {
  const resolvedTotalCounter = document.getElementById('home-resolved-total-count');
  const resolvedTotalInline = document.getElementById('home-resolved-total-inline');
  if (!resolvedTotalCounter && !resolvedTotalInline) return;

  const resolvedTotalCount = await fetchResolvedAnnouncementsCount();

  if (resolvedTotalCounter) resolvedTotalCounter.textContent = String(resolvedTotalCount);
  if (resolvedTotalInline) resolvedTotalInline.textContent = String(resolvedTotalCount);
}

/**
 * Loads the home announcement grid and binds modal controls.
 * @returns {Promise<void>} Promise resolving after initial home announcements are rendered.
 */
async function initHomeAnnouncements() {
  const grid = document.getElementById('home-announcements-grid');
  const empty = document.getElementById('home-empty');
  if (!grid || !empty) return;

  document.getElementById('modal-overlay')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeAnnouncementModal();
  });
  document.getElementById('modal-close')?.addEventListener('click', closeAnnouncementModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAnnouncementModal();
  });

  const announcements = await fetchAnnouncements();
  const trimmed = announcements.slice(0, HOME_MAX_CARDS);

  if (trimmed.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  trimmed.forEach((ann) => grid.appendChild(createAnnouncementCard(ann)));
}

/**
 * Initializes home page data and recurring stats refresh after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when the initial home widgets are loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([initHomeAnnouncements(), renderHeroStats(), renderHomeImpactStats()]);
  window.addEventListener('announcements:resolved-updated', renderHeroStats);
  window.addEventListener('announcements:resolved-updated', renderHomeImpactStats);
  setInterval(renderHeroStats, 30000);
});
