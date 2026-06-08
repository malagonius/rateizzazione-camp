/* ============================================================
 * acquisti.js — Package purchases, pricing, and week assignment
 * ============================================================ */

const CAMP_BASE_PACKAGES = {
  pranzo: { key: 'pranzo', label: 'Pranzo', shortLabel: 'Pranzo', rates: { one: 90, four: 340, thirteen: 1040 } },
  no_pranzo: { key: 'no_pranzo', label: 'No pranzo', shortLabel: 'No pranzo', rates: { one: 80, four: 300, thirteen: 910 } },
  ticket_10: { key: 'ticket_10', label: '10 ticket', shortLabel: '10 ticket', rates: { one: 180, four: 180, thirteen: 180 }, isTicketBundle: true, ticketTotal: 10, fixedPrice: 180 }
};

const CAMP_ADDON_PACKAGES = {
  none: { key: 'none', label: 'Nessun extra', shortLabel: 'Nessun extra', rates: { one: 0, four: 0, thirteen: 0 }, preLabel: '', postLabel: '' },
  pre_730: { key: 'pre_730', label: 'Pre 7:30-9:00', shortLabel: 'Pre 7:30', rates: { one: 35, four: 120, thirteen: 325 }, preLabel: 'Ingresso 7:30', postLabel: '' },
  pre_800: { key: 'pre_800', label: 'Pre 8:00-9:00', shortLabel: 'Pre 8:00', rates: { one: 30, four: 100, thirteen: 260 }, preLabel: 'Ingresso 8:00', postLabel: '' },
  post: { key: 'post', label: 'Post 17:00-18:00', shortLabel: 'Post', rates: { one: 35, four: 120, thirteen: 325 }, preLabel: '', postLabel: 'Uscita 18:00' },
  prepost_730: { key: 'prepost_730', label: 'Pre 7:30 + post', shortLabel: 'Pre 7:30 + post', rates: { one: 60, four: 200, thirteen: 520 }, preLabel: 'Ingresso 7:30', postLabel: 'Uscita 18:00' },
  prepost_800: { key: 'prepost_800', label: 'Pre 8:00 + post', shortLabel: 'Pre 8:00 + post', rates: { one: 55, four: 180, thirteen: 455 }, preLabel: 'Ingresso 8:00', postLabel: 'Uscita 18:00' }
};

const DEFAULT_PURCHASE_FORM = { basePackage: 'pranzo', addonPackage: 'none', selectedWeeks: [], discountType: 'none', discountValue: 0 };
state.currentPurchasePersonId = null;
state.purchaseForm = { ...DEFAULT_PURCHASE_FORM };

function isTicketBundlePackage(basePackage) {
  return !!CAMP_BASE_PACKAGES[basePackage]?.isTicketBundle;
}

function calculateTieredPrice(weekCount, rates) {
  if (!weekCount || weekCount <= 0) return 0;
  if (weekCount >= 13) return rates.thirteen;
  return Math.floor(weekCount / 4) * rates.four + (weekCount % 4) * rates.one;
}

function calculatePackageQuote({ weeks, selectedWeeks, basePackage, addonPackage, discountType, discountValue }) {
  const sourceWeeks = weeks || selectedWeeks || [];
  const weekCount = Array.from(new Set(sourceWeeks.map(w => parseInt(w)).filter(w => !isNaN(w)))).length;
  const base = CAMP_BASE_PACKAGES[basePackage] || CAMP_BASE_PACKAGES.pranzo;
  const addon = CAMP_ADDON_PACKAGES[addonPackage] || CAMP_ADDON_PACKAGES.none;
  const baseAmount = base.isTicketBundle ? num(base.fixedPrice) : calculateTieredPrice(weekCount, base.rates);
  const addonAmount = base.isTicketBundle ? 0 : calculateTieredPrice(weekCount, addon.rates);
  const grossAmount = baseAmount + addonAmount;
  const cleanDiscountValue = Math.max(0, num(discountValue));
  let discountAmount = 0;
  if (discountType === 'amount') discountAmount = Math.min(grossAmount, cleanDiscountValue);
  if (discountType === 'percent') discountAmount = Math.min(grossAmount, grossAmount * cleanDiscountValue / 100);
  return { baseAmount, addonAmount, grossAmount, discountAmount, finalAmount: Math.max(0, grossAmount - discountAmount) };
}

function normalizePersonPurchases(person) {
  if (!person) return [];
  if (!Array.isArray(person.purchases)) person.purchases = [];
  person.purchases.forEach(purchase => {
    if (!purchase.id) purchase.id = uid();
    if (!purchase.createdAt) purchase.createdAt = new Date().toISOString();
    if (!Array.isArray(purchase.weeks)) purchase.weeks = [];
    purchase.weeks = purchase.weeks.map(w => parseInt(w)).filter(w => !isNaN(w)).sort((a, b) => a - b);
    if (!CAMP_BASE_PACKAGES[purchase.basePackage]) purchase.basePackage = 'pranzo';
    if (!CAMP_ADDON_PACKAGES[purchase.addonPackage]) purchase.addonPackage = 'none';
    if (!['none', 'amount', 'percent'].includes(purchase.discountType)) purchase.discountType = 'none';
    purchase.discountValue = num(purchase.discountValue);
    if (isTicketBundlePackage(purchase.basePackage)) {
      purchase.addonPackage = 'none';
      purchase.ticketTotal = num(purchase.ticketTotal) || CAMP_BASE_PACKAGES.ticket_10.ticketTotal;
      if (!Array.isArray(purchase.ticketUses)) purchase.ticketUses = [];
    }
    Object.assign(purchase, calculatePackageQuote(purchase));
  });
  return person.purchases;
}

function getTicketBundlePurchases(person) {
  return normalizePersonPurchases(person).filter(purchase => isTicketBundlePackage(purchase.basePackage));
}

function getTicketRemaining(purchase) {
  if (!purchase || !isTicketBundlePackage(purchase.basePackage)) return 0;
  return Math.max(0, num(purchase.ticketTotal) - (Array.isArray(purchase.ticketUses) ? purchase.ticketUses.length : 0));
}

function getAvailableTicketBundle(person, purchaseId = null) {
  return getTicketBundlePurchases(person).find(purchase => {
    if (purchaseId && purchase.id !== purchaseId) return false;
    return getTicketRemaining(purchase) > 0;
  }) || null;
}

function localDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hasTicketUseOnDate(person, dateKey) {
  return getTicketBundlePurchases(person).some(purchase =>
    (purchase.ticketUses || []).some(use => use.date === dateKey)
  );
}

function getTicketRemainingForPerson(person) {
  return getTicketBundlePurchases(person).reduce((sum, purchase) => sum + getTicketRemaining(purchase), 0);
}

function getPurchasedWeeks(person, excludePurchaseId = null) {
  const weeks = new Set();
  normalizePersonPurchases(person).forEach(purchase => {
    if (excludePurchaseId && purchase.id === excludePurchaseId) return;
    purchase.weeks.forEach(week => weeks.add(week));
  });
  return weeks;
}

function getPurchaseForWeek(person, weekNum) {
  return normalizePersonPurchases(person).find(purchase => purchase.weeks.includes(parseInt(weekNum))) || null;
}

function getPurchasePackageText(purchase) {
  if (!purchase) return 'Nessun acquisto';
  const base = CAMP_BASE_PACKAGES[purchase.basePackage] || CAMP_BASE_PACKAGES.pranzo;
  const addon = CAMP_ADDON_PACKAGES[purchase.addonPackage] || CAMP_ADDON_PACKAGES.none;
  return addon.key === 'none' ? base.shortLabel : `${base.shortLabel} + ${addon.shortLabel}`;
}

function getPurchaseWeekLabel(weeks) {
  return weeks && weeks.length ? weeks.map(w => `S${w}`).join(', ') : 'Nessuna settimana';
}

function getPurchaseAddonInfo(purchase) {
  const addon = CAMP_ADDON_PACKAGES[purchase?.addonPackage] || CAMP_ADDON_PACKAGES.none;
  return { preLabel: addon.preLabel, postLabel: addon.postLabel, label: addon.shortLabel };
}

function recalcPersonTotalFromPurchases(person) {
  const purchases = normalizePersonPurchases(person);
  if (purchases.length) person.totale = purchases.reduce((sum, purchase) => sum + num(purchase.finalAmount), 0);
}

function syncPersonWeeksFromPurchases(person) {
  if (!person) return;
  normalizePersonPurchases(person);
  if (!person.eventIdManual) person.eventId = getEventForAge(person.eta);
  const weeks = getPurchasedWeeks(person);
  getTicketBundlePurchases(person).forEach(purchase => {
    (purchase.ticketUses || []).forEach(use => {
      const week = parseInt(use.weekNumber);
      if (!isNaN(week)) weeks.add(week);
    });
  });
  person.eventWeeks = Array.from(weeks).sort((a, b) => a - b);
}

async function useTicketForPerson(person, event, week, day, purchaseId = null) {
  if (!person || !event || !week || !day) return { ok: false, message: 'Evento o giorno non disponibile.' };
  const dayDate = getDayDate(event, week, day);
  const dateKey = localDateKey(dayDate);
  if (hasTicketUseOnDate(person, dateKey)) return { ok: false, message: 'Ticket gia usato oggi.' };
  const purchase = getAvailableTicketBundle(person, purchaseId);
  if (!purchase) return { ok: false, message: 'Nessun ticket disponibile.' };

  purchase.ticketUses.push({
    id: uid(),
    date: dateKey,
    eventId: event.id,
    weekNumber: week,
    day,
    usedAt: new Date().toISOString()
  });

  if (!Array.isArray(person.eventWeeks)) person.eventWeeks = [];
  if (!person.eventWeeks.includes(week)) person.eventWeeks.push(week);
  person.eventWeeks.sort((a, b) => a - b);

  let record = getPresenceRecord(event.id, week, person.id);
  if (!record) record = createPresenceRecord(event.id, week, person.id);
  record.days[day] = true;
  record.markedAt = new Date().toISOString();

  await dbPutTo(PRESENCES_STORE, record);
  await dbPut(person);
  return { ok: true, purchase, remaining: getTicketRemaining(purchase), dateKey };
}

function syncAllPurchasesState() {
  let changed = false;
  state.people.forEach(person => {
    const beforeWeeks = JSON.stringify(person.eventWeeks || []);
    const beforeTotal = num(person.totale);
    normalizePersonPurchases(person);
    syncPersonWeeksFromPurchases(person);
    recalcPersonTotalFromPurchases(person);
    if (JSON.stringify(person.eventWeeks || []) !== beforeWeeks || num(person.totale) !== beforeTotal) changed = true;
  });
  return changed;
}

function getPurchasePerson() {
  if (!state.currentPurchasePersonId && state.currentId) state.currentPurchasePersonId = state.currentId;
  if (!state.currentPurchasePersonId && state.people.length) state.currentPurchasePersonId = state.people[0].id;
  return state.people.find(p => p.id === state.currentPurchasePersonId) || null;
}

function getPersonEventForPurchases(person) {
  if (!person) return null;
  if (!person.eventIdManual) person.eventId = getEventForAge(person.eta);
  return state.events.find(event => event.id === person.eventId) || null;
}

function createDefaultGroupsForEvent(event) {
  if (event.id === 'vivi_camp') {
    return VIVI_CAMP_AGE_GROUPS.map(cat => ({ id: event.id + '_' + cat.id, name: cat.label, descriptions: [''], memberIds: [], isDefault: true, ageGroupId: cat.id }));
  }
  return [{ id: event.id + '_group', name: event.name, descriptions: [''], memberIds: [], isDefault: true }];
}

async function ensureEventSupportsPurchasedWeeks(event, maxWeek) {
  if (!event || !maxWeek) return;
  let changed = false;
  if (!event.weekGroups) event.weekGroups = {};
  if (!event.numWeeks || event.numWeeks < maxWeek) { event.numWeeks = maxWeek; changed = true; }
  for (let week = 1; week <= event.numWeeks; week++) {
    if (!event.weekGroups[week]) { event.weekGroups[week] = createDefaultGroupsForEvent(event); changed = true; }
  }
  if (changed) await dbPutTo(EVENTS_STORE, event);
}

function renderPackageOptions() {
  const baseContainer = document.getElementById('purchase-base-options');
  const addonContainer = document.getElementById('purchase-addon-options');
  if (!baseContainer || !addonContainer) return;
  baseContainer.innerHTML = Object.values(CAMP_BASE_PACKAGES).map(pkg => `
    <label class="package-option ${state.purchaseForm.basePackage === pkg.key ? 'selected' : ''}">
      <input type="radio" name="purchase-base" value="${escapeHtml(pkg.key)}" ${state.purchaseForm.basePackage === pkg.key ? 'checked' : ''} />
      <span class="package-title">${escapeHtml(pkg.label)}</span>
      <span class="package-price">${pkg.isTicketBundle ? `${pkg.ticketTotal} ingressi - ${fmtMoney(pkg.fixedPrice)}` : `${fmtMoney(pkg.rates.one)} / sett. - ${fmtMoney(pkg.rates.four)} / 4 - ${fmtMoney(pkg.rates.thirteen)} / 13`}</span>
    </label>`).join('');
  const ticketSelected = isTicketBundlePackage(state.purchaseForm.basePackage);
  addonContainer.innerHTML = Object.values(CAMP_ADDON_PACKAGES).map(pkg => `
    <label class="package-option ${state.purchaseForm.addonPackage === pkg.key ? 'selected' : ''} ${ticketSelected ? 'disabled' : ''}">
      <input type="radio" name="purchase-addon" value="${escapeHtml(pkg.key)}" ${state.purchaseForm.addonPackage === pkg.key ? 'checked' : ''} ${ticketSelected ? 'disabled' : ''} />
      <span class="package-title">${escapeHtml(pkg.label)}</span>
      ${pkg.key === 'none' ? '' : `<span class="package-price">${fmtMoney(pkg.rates.one)} / sett. - ${fmtMoney(pkg.rates.four)} / 4 - ${fmtMoney(pkg.rates.thirteen)} / 13</span>`}
    </label>`).join('');
}

function renderPurchasePersonSelect() {
  const select = document.getElementById('purchase-person-select');
  if (!select) return;
  select.innerHTML = state.people.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'))
    .map(person => `<option value="${escapeHtml(person.id)}" ${person.id === state.currentPurchasePersonId ? 'selected' : ''}>${escapeHtml(person.nome || 'Senza nome')}</option>`).join('');
}

function formatPurchaseWeekLabel(event, week) {
  if (!event || !event.startDate) return `S${week}`;
  const start = getWeekStartMonday(event, week);
  if (isNaN(start.getTime())) return `S${week}`;
  const end = new Date(start);
  end.setDate(end.getDate() + 5);
  const startMonth = start.toLocaleDateString('it-IT', { month: 'short' });
  const endMonth = end.toLocaleDateString('it-IT', { month: 'short' });
  const range = startMonth === endMonth
    ? `${start.getDate()}-${end.getDate()} ${endMonth}`
    : `${start.getDate()} ${startMonth}-${end.getDate()} ${endMonth}`;
  return `S${week} (${range})`;
}

function renderPurchaseWeeks(person, event) {
  const container = document.getElementById('purchase-weeks');
  if (!container) return;
  if (!person) { container.innerHTML = '<div class="empty-inline">Nessuna persona disponibile.</div>'; return; }
  if (!event) { container.innerHTML = '<div class="empty-inline">Imposta eta o evento nella scheda dettaglio prima di registrare acquisti.</div>'; return; }
  if (isTicketBundlePackage(state.purchaseForm.basePackage)) {
    container.innerHTML = '<div class="empty-inline">Il pacchetto 10 ticket non richiede selezione settimane.</div>';
    return;
  }
  const maxWeeks = Math.max(event.numWeeks || 1, 13);
  const purchasedWeeks = getPurchasedWeeks(person);
  container.innerHTML = Array.from({ length: maxWeeks }, (_, idx) => {
    const week = idx + 1;
    const alreadyBought = purchasedWeeks.has(week);
    const weekLabel = formatPurchaseWeekLabel(event, week);
    return `<label class="event-week-checkbox ${alreadyBought ? 'week-disabled' : ''}" title="${alreadyBought ? 'Settimana gia acquistata' : weekLabel}">
      <input type="checkbox" data-purchase-week="${week}" ${state.purchaseForm.selectedWeeks.includes(week) ? 'checked' : ''}${alreadyBought ? ' disabled' : ''} /> ${escapeHtml(weekLabel)}${alreadyBought ? ' acquistata' : ''}
    </label>`;
  }).join('');
}

function renderPurchaseSummary(person, event) {
  const summary = document.getElementById('purchase-person-summary');
  if (!summary) return;
  if (!person) { summary.innerHTML = ''; return; }
  const boughtWeeks = Array.from(getPurchasedWeeks(person)).sort((a, b) => a - b);
  const ticketRemaining = getTicketRemainingForPerson(person);
  summary.innerHTML = `
    <span class="badge" style="background:#f3f4f6;color:var(--text);">${escapeHtml(event ? event.name : 'Evento non assegnato')}</span>
    <span class="badge badge-paid">${normalizePersonPurchases(person).length} acquisti</span>
    <span class="badge" style="background:var(--blue-bg);color:var(--primary);">${boughtWeeks.length} settimane</span>
    ${ticketRemaining ? `<span class="badge" style="background:#fef3c7;color:#92400e;">${ticketRemaining} ticket rimasti</span>` : ''}`;
}

function renderPurchaseQuote() {
  const quoteEl = document.getElementById('purchase-quote');
  if (!quoteEl) return;
  const quote = calculatePackageQuote({ ...state.purchaseForm, weeks: state.purchaseForm.selectedWeeks });
  quoteEl.innerHTML = `
    <div class="quote-item"><span>Settimane</span><strong>${state.purchaseForm.selectedWeeks.length}</strong></div>
    <div class="quote-item"><span>Pacchetto principale</span><strong>${fmtMoney(quote.baseAmount)}</strong></div>
    <div class="quote-item"><span>Pre / post</span><strong>${fmtMoney(quote.addonAmount)}</strong></div>
    <div class="quote-item"><span>Sconto</span><strong>-${fmtMoney(quote.discountAmount)}</strong></div>
    <div class="quote-item quote-total"><span>Totale acquisto</span><strong>${fmtMoney(quote.finalAmount)}</strong></div>`;
}

function renderPurchaseList(person) {
  const list = document.getElementById('purchase-list');
  if (!list) return;
  if (!person) { list.innerHTML = '<div class="empty-inline">Nessuna persona selezionata.</div>'; return; }
  const purchases = normalizePersonPurchases(person);
  if (!purchases.length) { list.innerHTML = '<div class="empty-inline">Nessun acquisto registrato.</div>'; return; }
  list.innerHTML = purchases.map(purchase => `
    <div class="purchase-card" data-purchase-id="${escapeHtml(purchase.id)}">
      <div><strong>${escapeHtml(getPurchasePackageText(purchase))}</strong><div class="purchase-meta">${escapeHtml(isTicketBundlePackage(purchase.basePackage) ? `${getTicketRemaining(purchase)}/${purchase.ticketTotal} ticket rimasti` : getPurchaseWeekLabel(purchase.weeks))} - ${purchase.createdAt ? fmtDateDisplay(purchase.createdAt) : ''}</div></div>
      <div class="purchase-card-amount"><strong>${fmtMoney(purchase.finalAmount)}</strong>${purchase.discountAmount ? `<span class="purchase-meta">sconto ${fmtMoney(purchase.discountAmount)}</span>` : ''}</div>
      <button class="danger" data-action="remove-purchase" data-purchase-id="${escapeHtml(purchase.id)}" title="Rimuovi acquisto">x</button>
    </div>`).join('');
}

function renderDetailPurchases(person) {
  const container = document.getElementById('d-purchases-summary');
  if (!container || !person) return;
  const purchases = normalizePersonPurchases(person);
  if (!purchases.length) { container.innerHTML = '<div class="empty-inline">Nessun acquisto registrato. Le settimane si gestiscono dalla scheda Acquisti.</div>'; return; }
  const event = getPersonEventForPurchases(person);
  const week = event ? getCurrentWeekNumber(event) : null;
  const day = event ? getCurrentDayOfWeek(event) : null;
  const dateKey = event && week && day ? localDateKey(getDayDate(event, week, day)) : null;
  const usedToday = dateKey ? hasTicketUseOnDate(person, dateKey) : false;
  container.innerHTML = purchases.map(purchase => {
    const isTicket = isTicketBundlePackage(purchase.basePackage);
    const remaining = getTicketRemaining(purchase);
    const detail = isTicket ? `${remaining}/${purchase.ticketTotal} ticket rimasti` : getPurchaseWeekLabel(purchase.weeks);
    const ticketDisabled = remaining <= 0 || usedToday || !week || !day;
    return `
    <div class="purchase-card compact ${isTicket ? 'ticket-card' : ''}" data-purchase-id="${escapeHtml(purchase.id)}">
      <div><strong>${escapeHtml(getPurchasePackageText(purchase))}</strong><div class="purchase-meta">${escapeHtml(detail)}</div></div>
      <div class="purchase-card-amount"><strong>${fmtMoney(purchase.finalAmount)}</strong></div>
      <div class="purchase-actions">
        ${isTicket ? `<button class="ghost" data-action="use-detail-ticket" data-purchase-id="${escapeHtml(purchase.id)}" ${ticketDisabled ? 'disabled' : ''}>${usedToday ? 'Ticket usato' : 'Usa ticket'}</button>` : ''}
        <button class="danger subtle-danger" data-action="remove-detail-purchase" data-purchase-id="${escapeHtml(purchase.id)}" title="Rimuovi acquisto">Rimuovi</button>
      </div>
    </div>`;
  }).join('');
}

function resetPurchaseForm(keepPerson = true) {
  state.purchaseForm = { ...DEFAULT_PURCHASE_FORM, selectedWeeks: [] };
  if (!keepPerson) state.currentPurchasePersonId = null;
  const discountType = document.getElementById('purchase-discount-type');
  const discountValue = document.getElementById('purchase-discount-value');
  if (discountType) discountType.value = state.purchaseForm.discountType;
  if (discountValue) discountValue.value = state.purchaseForm.discountValue;
}

function renderAcquisti() {
  if (!state.people.length) { renderPurchasePersonSelect(); renderPurchaseSummary(null, null); renderPurchaseQuote(); renderPurchaseList(null); return; }
  const person = getPurchasePerson();
  const event = getPersonEventForPurchases(person);
  renderPurchasePersonSelect();
  renderPackageOptions();
  renderPurchaseWeeks(person, event);
  renderPurchaseSummary(person, event);
  renderPurchaseQuote();
  renderPurchaseList(person);
}

function showAcquisti(personId = null) {
  if (personId) state.currentPurchasePersonId = personId;
  else if (state.currentId) state.currentPurchasePersonId = state.currentId;
  else if (!state.currentPurchasePersonId && state.people.length) state.currentPurchasePersonId = state.people[0].id;
  state.activeTab = 'acquisti';
  document.querySelectorAll('#tab-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === 'acquisti'));
  ['view-list', 'view-detail', 'view-events', 'view-event-form', 'view-event-detail', 'view-presences-overview', 'view-acquisti'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
  document.getElementById('btn-back').classList.add('hidden');
  document.getElementById('view-acquisti').classList.remove('hidden');
  renderAcquisti();
}

async function savePurchase() {
  const person = getPurchasePerson();
  if (!person) return;
  const event = getPersonEventForPurchases(person);
  if (!event) { toast('Imposta eta o evento per assegnare il pacchetto.', 'error'); return; }
  const isTicket = isTicketBundlePackage(state.purchaseForm.basePackage);
  const weeks = isTicket ? [] : [...state.purchaseForm.selectedWeeks].sort((a, b) => a - b);
  if (!isTicket && !weeks.length) { toast('Seleziona almeno una settimana.', 'error'); return; }
  const duplicate = weeks.find(week => getPurchasedWeeks(person).has(week));
  if (duplicate) { toast(`La settimana ${duplicate} e gia stata acquistata.`, 'error'); return; }
  const quote = calculatePackageQuote({ ...state.purchaseForm, weeks });
  normalizePersonPurchases(person).push({
    id: uid(),
    createdAt: new Date().toISOString(),
    eventId: event.id,
    eventName: event.name,
    weeks,
    basePackage: state.purchaseForm.basePackage,
    addonPackage: isTicket ? 'none' : state.purchaseForm.addonPackage,
    discountType: state.purchaseForm.discountType,
    discountValue: num(state.purchaseForm.discountValue),
    ticketTotal: isTicket ? CAMP_BASE_PACKAGES.ticket_10.ticketTotal : undefined,
    ticketUses: isTicket ? [] : undefined,
    ...quote
  });
  syncPersonWeeksFromPurchases(person);
  recalcPersonTotalFromPurchases(person);
  if (weeks.length) await ensureEventSupportsPurchasedWeeks(event, Math.max(...weeks));
  await dbPut(person);
  resetPurchaseForm();
  renderAcquisti();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
  toast('Acquisto registrato', 'success');
}

async function removePersonPurchase(personId, purchaseId) {
  const person = state.people.find(p => p.id === personId);
  if (!person) return;
  const purchase = normalizePersonPurchases(person).find(item => item.id === purchaseId);
  if (!purchase) return;
  const password = await promptPassword('Inserisci la password per rimuovere questo acquisto:');
  if (password === null) return;
  if (password !== PASSWORD) { toast('Password errata', 'error'); return; }
  if (!confirm(`Rimuovere l'acquisto "${getPurchasePackageText(purchase)}"?`)) return;
  person.purchases = person.purchases.filter(item => item.id !== purchaseId);
  syncPersonWeeksFromPurchases(person);
  if (person.purchases.length) recalcPersonTotalFromPurchases(person);
  else person.totale = 0;
  await dbPut(person);
  renderAcquisti();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
  toast('Acquisto rimosso', 'success');
}

function bindPurchaseEvents() {
  document.getElementById('purchase-person-select').addEventListener('change', (e) => {
    state.currentPurchasePersonId = e.target.value;
    resetPurchaseForm();
    renderAcquisti();
  });
  document.getElementById('view-acquisti').addEventListener('change', (e) => {
    if (e.target.name === 'purchase-base') {
      state.purchaseForm.basePackage = e.target.value;
      if (isTicketBundlePackage(e.target.value)) {
        state.purchaseForm.addonPackage = 'none';
        state.purchaseForm.selectedWeeks = [];
      }
      renderAcquisti();
    }
    if (e.target.name === 'purchase-addon') { state.purchaseForm.addonPackage = e.target.value; renderAcquisti(); }
    if (e.target.dataset.purchaseWeek) {
      const week = parseInt(e.target.dataset.purchaseWeek);
      if (e.target.checked && !state.purchaseForm.selectedWeeks.includes(week)) state.purchaseForm.selectedWeeks.push(week);
      if (!e.target.checked) state.purchaseForm.selectedWeeks = state.purchaseForm.selectedWeeks.filter(w => w !== week);
      state.purchaseForm.selectedWeeks.sort((a, b) => a - b);
      renderPurchaseQuote();
    }
    if (e.target.id === 'purchase-discount-type') { state.purchaseForm.discountType = e.target.value; renderPurchaseQuote(); }
  });
  document.getElementById('view-acquisti').addEventListener('input', (e) => {
    if (e.target.id !== 'purchase-discount-value') return;
    state.purchaseForm.discountValue = num(e.target.value);
    renderPurchaseQuote();
  });
  document.getElementById('purchase-select-all').addEventListener('click', () => {
    if (isTicketBundlePackage(state.purchaseForm.basePackage)) return;
    const person = getPurchasePerson();
    const event = getPersonEventForPurchases(person);
    if (!person || !event) return;
    const purchasedWeeks = getPurchasedWeeks(person);
    state.purchaseForm.selectedWeeks = [];
    const maxWeeks = Math.max(event.numWeeks || 1, 13);
    for (let week = 1; week <= maxWeeks; week++) if (!purchasedWeeks.has(week)) state.purchaseForm.selectedWeeks.push(week);
    renderAcquisti();
  });
  document.getElementById('purchase-clear-weeks').addEventListener('click', () => { state.purchaseForm.selectedWeeks = []; renderAcquisti(); });
  document.getElementById('btn-save-purchase').addEventListener('click', savePurchase);
  document.getElementById('purchase-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="remove-purchase"]');
    if (!btn) return;
    const person = getPurchasePerson();
    if (person) await removePersonPurchase(person.id, btn.dataset.purchaseId);
  });
}
