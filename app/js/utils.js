/* ============================================================
 * utils.js — State and utility functions
 * ============================================================ */

const CAMP_UTILS = window.CAMP_UTILS_CONFIG;
const PASSWORD = CAMP_UTILS.password;
const DEFAULT_INSTALLMENTS = CAMP_UTILS.installments;
const CURRENT_YEAR = new Date().getFullYear();
const STATIC_EVENTS = CAMP_UTILS.events.map(event => ({
  ...event,
  name: `${event.name} ${CURRENT_YEAR}`
}));
const VIVI_CAMP_AGE_GROUPS = CAMP_UTILS.viviCamp.ageGroups;
const VIVI_CAMP_MAX_GROUP_SIZE = CAMP_UTILS.viviCamp.maxGroupSize;

function getEventForAge(age) {
  if (age == null || age === '' || isNaN(Number(age))) return null;
  const a = Number(age);
  for (const ev of STATIC_EVENTS) {
    if (a >= ev.ageMin && a <= ev.ageMax) return ev.id;
  }
  return null;
}

const EXCEL_COL_MAP = CAMP_UTILS.excelColumns;

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

function normalizeBoolean(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ['si', 'sì', 'yes', 'y', 's', 'true', '1', 'x'].includes(s);
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

function nextUnpaidInstallment(person) {
  return person.installments.find(i => !num(i.reale));
}

const STATUS_LABEL = CAMP_UTILS.statusLabels;

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
