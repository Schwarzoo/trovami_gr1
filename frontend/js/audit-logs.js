const token = localStorage.getItem('token');
const payload = token ? decodeJwt(token) : null;

if (!token || payload?.role !== 'admin') {
  window.location.href = '/pages/login.html';
}

const ITEMS_PER_PAGE = 50;

const state = {
  search: '',
  sortBy: 'createdAt',
  sortDir: 'desc',
  currentPage: 1,
  allLogs: [],
  filteredLogs: []
};

const authHeader = { Authorization: 'Bearer ' + token };
const body = document.getElementById('auditTableBody');
const statusEl = document.getElementById('auditStatus');
const searchInput = document.getElementById('auditSearch');
const prevBtn = document.getElementById('auditPrevBtn');
const nextBtn = document.getElementById('auditNextBtn');
const pageNumEl = document.getElementById('auditPageNum');
const totalPagesEl = document.getElementById('auditTotalPages');

/**
 * Filtra i log in base alla ricerca
 * @returns {Array<Object>} Log filtrati
 */
function filterLogs() {
  if (!state.search) {
    return state.allLogs;
  }
  const searchLower = state.search.toLowerCase();
  return state.allLogs.filter((log) => {
    return (
      (log?.actorName?.toLowerCase().includes(searchLower) || false) ||
      (log?.action?.toLowerCase().includes(searchLower) || false) ||
      (log?.targetUsername?.toLowerCase().includes(searchLower) || false)
    );
  });
}

/**
 * Calcola le pagine e restituisce i log per la pagina corrente
 * @returns {Array<Object>} Log per la pagina corrente
 */
function getPaginatedLogs() {
  const start = (state.currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return state.filteredLogs.slice(start, end);
}

/**
 * Aggiorna l'interfaccia di paginazione
 * @returns {void}
 */
function updatePaginationUI() {
  const totalPages = Math.ceil(state.filteredLogs.length / ITEMS_PER_PAGE) || 1;

  pageNumEl.textContent = state.currentPage;
  totalPagesEl.textContent = totalPages;

  prevBtn.disabled = state.currentPage === 1;
  nextBtn.disabled = state.currentPage >= totalPages;

  statusEl.textContent = `${state.filteredLogs.length} log trovati (pagina ${state.currentPage} di ${totalPages})`;
}

/**
 * Renderizza i log della pagina corrente
 * @returns {void}
 */
function renderCurrentPage() {
  const logs = getPaginatedLogs();
  body.innerHTML = '';

  if (!logs.length) {
    if (state.filteredLogs.length === 0) {
      statusEl.textContent = 'Nessun log trovato';
    }
    return;
  }

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
 * Construisce l'URL per il recupero degli audit logs
 * @returns {string} URL con parametri di sort e limite
 */
function buildUrl() {
  const params = new URLSearchParams({
    limit: '500',
    sortBy: state.sortBy,
    sortDir: state.sortDir
  });
  if (state.search) params.set('search', state.search);
  return `/api/v1/admin/audit-logs?${params.toString()}`;
}

/**
 * Carica i log dall'API e aggiorna lo stato
 * @returns {Promise<void>}
 */
async function loadAuditLogs() {
  statusEl.textContent = 'Caricamento...';
  try {
    const res = await fetch(buildUrl(), { headers: authHeader });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.userMessage || data.message || 'Errore recupero audit logs');
    }
    state.allLogs = await res.json();
    state.allLogs = Array.isArray(state.allLogs) ? state.allLogs : [];
    state.currentPage = 1;

    applyFiltersAndRender();
  } catch (err) {
    statusEl.textContent = err.message || 'Errore recupero audit logs';
    body.innerHTML = '';
    state.allLogs = [];
    state.filteredLogs = [];
    state.currentPage = 1;
    updatePaginationUI();
  }
}

/**
 * Applica i filtri e renderizza i risultati
 * @returns {void}
 */
function applyFiltersAndRender() {
  state.filteredLogs = filterLogs();
  state.currentPage = 1;
  updatePaginationUI();
  renderCurrentPage();
}

/**
 * Aggiorna lo stato dei pulsanti di sort
 * @returns {void}
 */
function updateSortButtons() {
  document.querySelectorAll('[data-sort]').forEach((button) => {
    const isActive = button.dataset.sort === state.sortBy;
    button.classList.toggle('is-active', isActive);
    button.textContent = button.textContent.replace(/\s[↑↓]$/, '');
    if (isActive) button.textContent += state.sortDir === 'asc' ? ' ↑' : ' ↓';
  });
}

// Event listeners per il sort
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

// Event listener per la ricerca con debounce
let searchTimer = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    applyFiltersAndRender();
  }, 250);
});

// Event listeners per la paginazione
prevBtn.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    updatePaginationUI();
    renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

nextBtn.addEventListener('click', () => {
  const totalPages = Math.ceil(state.filteredLogs.length / ITEMS_PER_PAGE) || 1;
  if (state.currentPage < totalPages) {
    state.currentPage++;
    updatePaginationUI();
    renderCurrentPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// Event listener per il refresh
document.getElementById('auditRefresh').addEventListener('click', loadAuditLogs);

// Inizializzazione
updateSortButtons();
loadAuditLogs();
