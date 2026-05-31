/**
 * Decodes a JWT payload without verifying the signature for client-side UI decisions.
 * @param {string} token - token used by the function.
 * @returns {Object|string|Array<Object>|null} The result produced by the function.
 */
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch (e) {
    return null;
  }
}

const token = localStorage.getItem('token');
const payload = token ? decodeJwt(token) : null;

if (!token || payload?.role !== 'admin') {
  window.location.href = '/pages/login.html';
}

const state = {
  search: '',
  sortBy: 'createdAt',
  sortDir: 'desc'
};

const authHeader = { Authorization: 'Bearer ' + token };
const body = document.getElementById('auditTableBody');
const statusEl = document.getElementById('auditStatus');
const searchInput = document.getElementById('auditSearch');

/**
 * Escapes HTML-sensitive characters before inserting text into markup.
 * @param {Object} input - Value to normalize or format.
 * @returns {string} The result produced by the function.
 */
function escapeHtml(input) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Builds the audit-log API URL from the current filter and sort state.
 * @returns {Object|string|Array<Object>|null} The result produced by the function.
 */
function buildUrl() {
  const params = new URLSearchParams({
    limit: '200',
    sortBy: state.sortBy,
    sortDir: state.sortDir
  });
  if (state.search) params.set('search', state.search);
  return `http://localhost:3000/api/v1/admin/audit-logs?${params.toString()}`;
}

/**
 * Renders audit-log rows into the current table body.
 * @param {Array<Object>} logs - logs used by the function.
 * @returns {void} The result produced by the function.
 */
function renderRows(logs) {
  body.innerHTML = '';
  if (!logs.length) {
    statusEl.textContent = 'Nessun log trovato';
    return;
  }

  statusEl.textContent = `${logs.length} log visualizzati`;
  logs.forEach((log) => {
    const row = document.createElement('tr');
    const when = log?.createdAt ? new Date(log.createdAt).toLocaleString('it-IT') : '';
    row.innerHTML = `
      <td>${escapeHtml(log?.actorName || 'anonimo')}</td>
      <td>${escapeHtml(log?.action || '')}</td>
      <td>${escapeHtml(log?.targetUsername || '-')}</td>
      <td>${escapeHtml(when)}</td>
    `;
    body.appendChild(row);
  });
}

/**
 * Loads audit logs from the API and updates the table UI.
 * @returns {Promise<Object|Array<Object>|null>} Promise resolving when the operation completes.
 * @throws {Error} Returns or propagates an error when validation, authorization, or persistence fails.
 */
async function loadAuditLogs() {
  statusEl.textContent = 'Caricamento...';
  try {
    const res = await fetch(buildUrl(), { headers: authHeader });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Errore recupero audit logs');
    }
    const logs = await res.json();
    renderRows(Array.isArray(logs) ? logs : []);
  } catch (err) {
    statusEl.textContent = err.message || 'Errore recupero audit logs';
    body.innerHTML = '';
  }
}

/**
 * Updates the active state of audit-log sort controls.
 * @returns {void} The result produced by the function.
 */
function updateSortButtons() {
  document.querySelectorAll('[data-sort]').forEach((button) => {
    const isActive = button.dataset.sort === state.sortBy;
    button.classList.toggle('is-active', isActive);
    button.textContent = button.textContent.replace(/\s[↑↓]$/, '');
    if (isActive) button.textContent += state.sortDir === 'asc' ? ' ↑' : ' ↓';
  });
}

document.querySelectorAll('[data-sort]').forEach((button) => {
  button.addEventListener('click', () => {
    const nextSort = button.dataset.sort;
    if (state.sortBy === nextSort) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortBy = nextSort;
      state.sortDir = nextSort === 'createdAt' ? 'desc' : 'asc';
    }
    updateSortButtons();
    loadAuditLogs();
  });
});

let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    loadAuditLogs();
  }, 250);
});

document.getElementById('auditRefresh').addEventListener('click', loadAuditLogs);

updateSortButtons();
loadAuditLogs();
