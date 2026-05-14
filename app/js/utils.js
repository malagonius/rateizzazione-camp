/* ============================================================
 * utils.js — Constants, state, and utility functions
 * ============================================================ */

const PASSWORD = 'Kira'; // Simple password protection for amounts visibility toggle, simple to change but prevents casual snooping

const DEFAULT_INSTALLMENTS = [
  { key: 'acconto',    label: 'Acconto' },
  { key: 'maggio',     label: 'Rata Maggio' },
  { key: 'giugno',     label: 'Rata Giugno' },
  { key: 'luglio',     label: 'Rata Luglio' },
  { key: 'agosto',     label: 'Rata Agosto' },
  { key: 'settembre',  label: 'Rata Settembre' }
];

const AGE_GROUPS = [
  { id: 'age_0_3',   name: 'Gruppo 0-3 anni',   min: 0, max: 3 },
  { id: 'age_3_5',   name: 'Gruppo 3-5 anni',   min: 3, max: 5 },
  { id: 'age_6_7',   name: 'Gruppo 6-7 anni',   min: 6, max: 7 },
  { id: 'age_8_10',  name: 'Gruppo 8-10 anni',  min: 8, max: 10 },
  { id: 'age_11_13', name: 'Gruppo 11-13 anni', min: 11, max: 13 }
];

// Map of Excel column groups (planned, actual, date) per default installment
const EXCEL_COL_MAP = {
  acconto:   { ipotesi: 'IPOTESI ACCONTO',         reale: 'ACCONTO REALE',          data: 'DATA ACCONTO' },
  maggio:    { ipotesi: 'IPOTESI RATA MAGGIO',     reale: 'RATA MAGGIO REALE',      data: 'DATA MAGGIO' },
  giugno:    { ipotesi: 'IPOTESI RATA GIUGNO',     reale: 'RATA GIUGNO REALE',      data: 'DATA GIUGNO' },
  luglio:    { ipotesi: 'IPOTESI RATA LUGLIO',     reale: 'RATA LUGLIO REALE',      data: 'DATA LUGLIO' },
  agosto:    { ipotesi: 'IPOTESI RATA AGOSTO',     reale: 'RATA AGOSTO REALE',      data: 'DATA AGOSTO' },
  settembre: { ipotesi: 'IPOTESI RATA SETTEMBRE',  reale: 'RATA SETTEMBRE REALE',   data: 'DATA SETTEMBRE' }
};

// ----- App state -----
const state = {
  people: [],
  filtered: [],
  search: '',
  statusFilter: '',
  sortKey: 'nome',
  sortDir: 'asc',
  currentId: null,
  amountsVisible: false,
  events: [],
  presences: [],
  currentEventId: null,
  currentWeek: 1,
  activeTab: 'rateizzazione',
  eventSubView: 'groups'
};

// ============================================================
// Utilities
// ============================================================
function uid() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

function normalizeAssistenza(v) {
  if (v == null) return 'No';
  const s = String(v).trim().toLowerCase();
  if (!s) return 'No';
  if (['Si','Sì', 'si', 'sì', 'yes', 'y', 's', 'true', '1', 'x'].includes(s)) return 'Si';
  return 'No';
}

function num(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function fmtMoney(v) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num(v));
}

function fmtDateInput(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // String dates from Excel — try to parse
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function fmtDateDisplay(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('it-IT');
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function totalPaid(person) {
  return person.installments.reduce((s, i) => s + num(i.reale), 0);
}

function statusOf(person) {
  const due = num(person.totale);
  const paid = totalPaid(person);
  if (due <= 0 && paid <= 0) return 'unpaid';
  if (paid <= 0) return 'unpaid';
  if (paid >= due - 0.01 && paid <= due + 0.01) return 'paid';
  if (paid > due) return 'overpaid';
  return 'partial';
}

const STATUS_LABEL = {
  paid: 'Pagato',
  partial: 'Parziale',
  unpaid: 'Non pagato',
  overpaid: 'Sovrappagato'
};

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast ' + type; }, 2500);
}

// ============================================================
// Custom password prompt with masked input
// Replaces native prompt() so the typed password is hidden.
// Returns the entered string, or null if cancelled.
// ============================================================
function promptPassword(message = 'Inserisci la password:', title = 'Password richiesta') {
  return new Promise((resolve) => {
    const backdrop = document.getElementById('password-modal');
    const input = document.getElementById('password-modal-input');
    const okBtn = document.getElementById('password-modal-ok');
    const cancelBtn = document.getElementById('password-modal-cancel');
    const msgEl = document.getElementById('password-modal-message');
    const titleEl = document.getElementById('password-modal-title');

    titleEl.textContent = title;
    msgEl.textContent = message;
    input.value = '';
    backdrop.classList.add('show');
    // Focus the input after the transition starts
    setTimeout(() => input.focus(), 50);

    function cleanup(result) {
      backdrop.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keydown', onKey);
      backdrop.removeEventListener('click', onBackdropClick);
      input.value = '';
      resolve(result);
    }
    function onOk() { cleanup(input.value); }
    function onCancel() { cleanup(null); }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); onOk(); }
      else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    function onBackdropClick(e) {
      if (e.target === backdrop) onCancel();
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', onBackdropClick);
  });
}

// ============================================================
// Excel parsing date helper
// SheetJS returns dates as serial numbers when cellDates:false,
// or Date objects when cellDates:true.
// ============================================================
function excelDateToISO(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // Excel serial number
    const ms = Math.round((v - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Try string parsing — handle formats like "23/04/2025" or "23/04//2025"
  const s = String(v).replace(/\/+/g, '/').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = '20' + yy;
    const d = new Date(`${yy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// Normalize header for fuzzy matching
function normHeader(h) {
  return String(h || '').toUpperCase().replace(/\s+/g, ' ').trim();
}
