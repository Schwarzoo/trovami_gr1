(function () {
  const ROOT_ID = 'mock-inbox-root';
  const STYLE_ID = 'mock-inbox-styles';
  const ENDPOINT = '/api/v1/mock-emails';
  // Reduce aggressiveness: refresh every 30 seconds by default
  const REFRESH_INTERVAL_MS = 30000;

  let refreshTimer = null;
  let lastRenderedSignature = '';

  /**
   * Injects the widget stylesheet into the document head once.
   * @returns {void}
   */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID} {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 9999;
        font-family: inherit;
      }

      #${ROOT_ID} .mock-inbox-trigger {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        background: linear-gradient(135deg, #1f6feb, #2d9cdb);
        color: #fff;
        font-weight: 700;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
        cursor: pointer;
      }

      #${ROOT_ID} .mock-inbox-trigger:hover {
        transform: translateY(-1px);
      }

      #${ROOT_ID} .mock-inbox-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      #${ROOT_ID}.is-open .mock-inbox-backdrop {
        display: flex;
      }

      #${ROOT_ID} .mock-inbox-modal {
        width: min(720px, 100%);
        max-height: min(80vh, 760px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-radius: 22px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
      }

      #${ROOT_ID} .mock-inbox-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        background: linear-gradient(135deg, rgba(31, 111, 235, 0.08), rgba(45, 156, 219, 0.12));
      }

      #${ROOT_ID} .mock-inbox-title {
        margin: 0;
        font-size: 1.1rem;
      }

      #${ROOT_ID} .mock-inbox-close {
        border: 0;
        background: rgba(15, 23, 42, 0.08);
        color: #0f172a;
        width: 38px;
        height: 38px;
        border-radius: 999px;
        cursor: pointer;
      }

      #${ROOT_ID} .mock-inbox-body {
        padding: 18px 22px 24px;
        overflow: auto;
      }

      #${ROOT_ID} .mock-inbox-empty,
      #${ROOT_ID} .mock-inbox-loading {
        padding: 18px;
        border-radius: 16px;
        background: #f8fafc;
        color: #475569;
      }

      #${ROOT_ID} .mock-inbox-list {
        display: grid;
        gap: 14px;
      }

      #${ROOT_ID} .mock-inbox-item {
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 18px;
        padding: 16px;
        background: #fff;
      }

      #${ROOT_ID} .mock-inbox-item__meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        margin-bottom: 12px;
        font-size: 0.9rem;
        color: #475569;
      }

      #${ROOT_ID} .mock-inbox-item__subject {
        margin: 0 0 10px;
        font-size: 1rem;
      }

      #${ROOT_ID} .mock-inbox-item__message {
        color: #0f172a;
        line-height: 1.5;
      }

      @media (max-width: 640px) {
        #${ROOT_ID} {
          right: 14px;
          bottom: 14px;
        }

        #${ROOT_ID} .mock-inbox-trigger {
          padding: 12px 16px;
        }

        #${ROOT_ID} .mock-inbox-modal {
          max-height: 86vh;
        }
      }
    `;
    document.head.appendChild(style);
  }

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

  function formatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  function openInbox(root) {
    root.classList.add('is-open');
    const trigger = root.querySelector('.mock-inbox-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
  }

  function closeInbox(root) {
    root.classList.remove('is-open');
    const trigger = root.querySelector('.mock-inbox-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

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

      injectStyles();
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