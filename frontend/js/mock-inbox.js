(function () {
  const ROOT_ID = 'mock-inbox-root';
  const ENDPOINT = '/api/v1/mock-emails';
  // Reduce aggressiveness: refresh every 30 seconds by default
  const REFRESH_INTERVAL_MS = 30000;

  let refreshTimer = null;
  let lastRenderedSignature = '';

  /**
   * Creates and inserts the mock inbox widget markup.
   * @returns {HTMLElement} Root element for the mock inbox widget.
   */
  function createMarkup() {
    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <button type="button" class="mock-inbox-trigger" aria-haspopup="dialog" aria-expanded="false">
        <span>Simulatore Email</span>
      </button>
      <div class="mock-inbox-backdrop" aria-hidden="true">
        <section class="mock-inbox-modal" role="dialog" aria-modal="true" aria-labelledby="mock-inbox-title">
          <header class="mock-inbox-header">
            <h2 id="mock-inbox-title" class="mock-inbox-title">Mock Inbox</h2>
            <button type="button" class="mock-inbox-close" aria-label="Chiudi">✕</button>
          </header>
          <div class="mock-inbox-body">
            <div class="mock-inbox-loading">Caricamento email simulate...</div>
          </div>
        </section>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  }

  /**
   * Formats an email timestamp for display.
   * @param {*} value - Timestamp value stored on the mock email.
   * @returns {string} Localized timestamp, original value, or an empty string.
   */
  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  /**
   * Opens the mock inbox modal.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @returns {void}
   */
  function openInbox(root) {
    root.classList.add('is-open');
    const trigger = root.querySelector('.mock-inbox-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  /**
   * Closes the mock inbox modal.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @returns {void}
   */
  function closeInbox(root) {
    root.classList.remove('is-open');
    const trigger = root.querySelector('.mock-inbox-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  /**
   * Renders mock email entries inside the inbox modal.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @param {Array<Object>} emails - Email entries returned by the mock inbox endpoint.
   * @returns {void}
   */
  function renderItems(root, emails) {
    const body = root.querySelector('.mock-inbox-body');
    if (!body) return;

    if (!Array.isArray(emails) || emails.length === 0) {
      body.innerHTML = '<div class="mock-inbox-empty">Nessuna email simulata disponibile.</div>';
      return;
    }

    body.innerHTML = '';
    const list = document.createElement('div');
    list.className = 'mock-inbox-list';

    emails.slice().reverse().forEach((email) => {
      const item = document.createElement('article');
      item.className = 'mock-inbox-item';

      const meta = document.createElement('div');
      meta.className = 'mock-inbox-item__meta';
      meta.innerHTML = `
        <span><strong>To:</strong> ${email.to || '-'}</span>
        <span><strong>Time:</strong> ${formatTime(email.time)}</span>
      `;

      const subject = document.createElement('h3');
      subject.className = 'mock-inbox-item__subject';
      subject.textContent = email.subject || '(senza oggetto)';

      const message = document.createElement('div');
      message.className = 'mock-inbox-item__message';
      message.innerHTML = email.message || '';

      item.append(meta, subject, message);
      list.appendChild(item);
    });

    body.appendChild(list);
  }

  /**
   * Builds a stable signature string for the current inbox payload.
   * @param {Array<Object>} emails - Email entries returned by the mock inbox endpoint.
   * @returns {string} Deterministic signature used to detect inbox changes.
   */
  function signatureForEmails(emails) {
    try {
      return JSON.stringify((Array.isArray(emails) ? emails : []).map((email) => ({
        to: email?.to || '',
        subject: email?.subject || '',
        message: email?.message || '',
        time: email?.time || ''
      })));
    } catch (error) {
      return String(Date.now());
    }
  }

  /**
   * Re-fetches the mock inbox and updates the rendered list when new emails appear.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @returns {Promise<void>} Promise resolving after the inbox refresh attempt.
   */
  async function refreshInbox(root) {
    try {
      const response = await fetch(ENDPOINT, { cache: 'no-cache' });
      if (!response.ok) return;

      const emails = await response.json();
      if (!Array.isArray(emails)) return;

      const signature = signatureForEmails(emails);
      if (signature === lastRenderedSignature) return;

      lastRenderedSignature = signature;
      renderItems(root, emails);
    } catch (error) {
      console.warn('Mock inbox non disponibile', error);
    }
  }

  /**
   * Starts the periodic refresh loop for the mock inbox widget.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @returns {void} No return value.
   */
  /**
   * Starts the periodic inbox refresh loop.
   * @param {HTMLElement} root - Root element that contains the mock inbox widget.
   * @returns {void}
   */
  function startAutoRefresh(root) {
    if (refreshTimer) return;
    refreshTimer = window.setInterval(() => {
      refreshInbox(root);
    }, REFRESH_INTERVAL_MS);
  }

  /**
   * Boots the mock inbox widget when the backend exposes mock emails.
   * @returns {Promise<void>} Promise resolving after the widget setup attempt.
   */
  async function boot() {
    try {
      const response = await fetch(ENDPOINT, { cache: 'no-cache' });
      if (!response.ok) return;

      const emails = await response.json();
      if (!Array.isArray(emails)) return;

      const root = createMarkup();
      const backdrop = root.querySelector('.mock-inbox-backdrop');
      const trigger = root.querySelector('.mock-inbox-trigger');
      const closeButton = root.querySelector('.mock-inbox-close');

      lastRenderedSignature = signatureForEmails(emails);
      renderItems(root, emails);
      startAutoRefresh(root);

      trigger?.addEventListener('click', async () => {
        await refreshInbox(root);
        openInbox(root);
      });
      closeButton?.addEventListener('click', () => closeInbox(root));
      backdrop?.addEventListener('click', (event) => {
        if (event.target === backdrop) closeInbox(root);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeInbox(root);
      });
    } catch (error) {
      console.warn('Mock inbox non disponibile', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
