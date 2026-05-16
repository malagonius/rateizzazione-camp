/* ============================================================
 * presenze.js — Tab navigation, Events, Groups, Presences
 * ============================================================ */

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const DAY_COUNT = 6; // Monday to Saturday

// ============================================================
// Print helper — opens a new window with styled content
// ============================================================
function printContent(title, htmlContent) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { toast('Popup bloccato dal browser', 'error'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; color: #1f2937; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 0 0 12px; color: #6b7280; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  th, td { padding: 5px 8px; border: 1px solid #d1d5db; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  td.center { text-align: center; }
  .summary { font-weight: 600; margin-top: 8px; font-size: 13px; }
  .muted { color: #6b7280; font-size: 11px; }
  .print-date { font-size: 11px; color: #9ca3af; margin-bottom: 16px; }
  @media print { body { margin: 10px; } }
</style></head><body>
<div class="print-date">Stampato il ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
${htmlContent}
<script>window.onload = function() { window.print(); }<\/script>
</body></html>`);
  win.document.close();
}

// ============================================================
// Tab navigation
// ============================================================
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('#tab-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  ['view-list', 'view-detail', 'view-events', 'view-event-form', 'view-event-detail', 'view-presences-overview'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('btn-back').classList.add('hidden');

  if (tab === 'rateizzazione') {
    if (state.currentId) {
      document.getElementById('view-detail').classList.remove('hidden');
      document.getElementById('btn-back').classList.remove('hidden');
    } else {
      document.getElementById('view-list').classList.remove('hidden');
    }
  } else if (tab === 'presenze') {
    document.getElementById('view-events').classList.remove('hidden');
    renderEventsList();
  }
}

// ============================================================
// Week-based groups helpers
// ============================================================
function getWeekGroups(event, weekNum) {
  if (!event.weekGroups) {
    event.weekGroups = {};
    const baseGroups = event.groups || [];
    for (let w = 1; w <= event.numWeeks; w++) {
      event.weekGroups[w] = JSON.parse(JSON.stringify(baseGroups));
    }
    delete event.groups;
  }
  if (!event.weekGroups[weekNum]) {
    const source = event.weekGroups[1] || [];
    event.weekGroups[weekNum] = source.map(g => ({
      ...JSON.parse(JSON.stringify(g)),
      memberIds: []
    }));
  }
  return event.weekGroups[weekNum];
}

function getAllMemberIdsForWeek(event, weekNum) {
  const groups = getWeekGroups(event, weekNum);
  const ids = new Set();
  groups.forEach(g => g.memberIds.forEach(id => ids.add(id)));
  return ids;
}

function getAllMemberIdsInEvent(event) {
  const ids = new Set();
  for (let w = 1; w <= event.numWeeks; w++) {
    const groups = getWeekGroups(event, w);
    groups.forEach(g => g.memberIds.forEach(id => ids.add(id)));
  }
  return ids;
}

// ============================================================
// Events CRUD
// ============================================================
function autoAssignGroups(people) {
  const groups = AGE_GROUPS.map(ag => ({
    id: ag.id + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
    name: ag.name,
    descriptions: [''],
    memberIds: []
  }));

  const withAge = people.filter(p => p.eta != null && p.eta !== '' && !isNaN(Number(p.eta)));
  const withoutAge = people.filter(p => p.eta == null || p.eta === '' || isNaN(Number(p.eta)));

  for (const p of withAge) {
    const age = Number(p.eta);
    let assigned = false;
    for (let i = 0; i < AGE_GROUPS.length; i++) {
      if (age >= AGE_GROUPS[i].min && age <= AGE_GROUPS[i].max) {
        groups[i].memberIds.push(p.id);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      groups[groups.length - 1].memberIds.push(p.id);
    }
  }

  for (let i = 0; i < withoutAge.length; i++) {
    groups[i % groups.length].memberIds.push(withoutAge[i].id);
  }

  return groups;
}

function getPersonById(id) {
  return state.people.find(p => p.id === id);
}

// ============================================================
// Form groups for current week based on person event assignments
// ============================================================
async function formGroupsForWeek() {
  const event = getCurrentEvent();
  if (!event) return;
  const weekNum = state.currentWeek;

  // Get people assigned to this event AND this specific week
  const eligiblePeople = state.people.filter(p =>
    p.eventId === event.id && Array.isArray(p.eventWeeks) && p.eventWeeks.includes(weekNum)
  );

  if (eligiblePeople.length === 0) {
    toast('Nessuna persona assegnata a questa settimana. Assegna le persone dall\'anagrafica.', 'error');
    return;
  }

  if (!confirm(`Formare i gruppi per la settimana ${weekNum} con ${eligiblePeople.length} persone assegnate?\nI gruppi attuali di questa settimana verranno sostituiti.`)) return;

  const newGroups = autoAssignGroups(eligiblePeople);
  event.weekGroups[weekNum] = newGroups;

  await dbPutTo(EVENTS_STORE, event);
  toast(`Gruppi formati per settimana ${weekNum}: ${eligiblePeople.length} persone in ${newGroups.length} gruppi`, 'success');
  renderGroups();
}

function getCurrentEvent() {
  return state.events.find(e => e.id === state.currentEventId);
}

/** Return the Monday of the week containing event.startDate */
function getEventMonday(event) {
  const d = new Date(event.startDate);
  const day = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const offset = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Return the Monday of week `weekNum` (1-based) for an event */
function getWeekStartMonday(event, weekNum) {
  const monday = getEventMonday(event);
  monday.setDate(monday.getDate() + (weekNum - 1) * 7);
  return monday;
}

function getCurrentWeekNumber(event) {
  if (!event) return 1;
  const monday = getEventMonday(event);
  const now = new Date();
  const diff = Math.floor((now - monday) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(event.numWeeks, diff + 1));
}

function renderEventsList() {
  const list = document.getElementById('events-list');
  const empty = document.getElementById('events-empty');

  if (!state.events.length) {
    list.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');

  list.innerHTML = state.events.map(ev => {
    const start = fmtDateDisplay(ev.startDate);
    const week1Groups = getWeekGroups(ev, 1);
    const totalMembers = week1Groups.reduce((s, g) => s + g.memberIds.length, 0);
    return `
      <div class="event-card-item" data-event-id="${escapeHtml(ev.id)}">
        <h3>${escapeHtml(ev.name)}</h3>
        <div class="event-meta">
          📅 Inizio: ${start}<br>
          📊 ${ev.numWeeks} settimane · ${week1Groups.length} gruppi · ${totalMembers} persone (sett. 1)
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// Week Picker — calendar that selects entire weeks (Mon-Sun)
// ============================================================
let wpViewYear, wpViewMonth, wpSelectedMonday;

function initWeekPicker() {
  const now = new Date();
  wpViewYear = now.getFullYear();
  wpViewMonth = now.getMonth();
  wpSelectedMonday = null;
  renderWeekPicker();

  document.getElementById('wp-prev-month').onclick = () => {
    wpViewMonth--;
    if (wpViewMonth < 0) { wpViewMonth = 11; wpViewYear--; }
    renderWeekPicker();
  };
  document.getElementById('wp-next-month').onclick = () => {
    wpViewMonth++;
    if (wpViewMonth > 11) { wpViewMonth = 0; wpViewYear++; }
    renderWeekPicker();
  };
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInWeek(date, monday) {
  if (!monday) return false;
  const d = new Date(date); d.setHours(0,0,0,0);
  const m = new Date(monday); m.setHours(0,0,0,0);
  const diff = d - m;
  return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000;
}

function renderWeekPicker() {
  const grid = document.getElementById('wp-grid');
  const label = document.getElementById('wp-month-label');
  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  label.textContent = `${monthNames[wpViewMonth]} ${wpViewYear}`;

  let html = '';
  const dayHeaders = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  dayHeaders.forEach(dh => { html += `<div class="wp-day-header">${dh}</div>`; });

  // First day of month
  const firstOfMonth = new Date(wpViewYear, wpViewMonth, 1);
  let startDay = firstOfMonth.getDay(); // 0=Sun
  startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Mon=0

  // Days in month
  const daysInMonth = new Date(wpViewYear, wpViewMonth + 1, 0).getDate();

  // Fill leading days from prev month
  const prevMonthDays = new Date(wpViewYear, wpViewMonth, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(wpViewYear, wpViewMonth - 1, prevMonthDays - i);
    const sel = wpSelectedMonday && isInWeek(d, wpSelectedMonday);
    html += `<div class="wp-day other-month${sel ? ' selected' : ''}" data-date="${d.toISOString()}">${d.getDate()}</div>`;
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(wpViewYear, wpViewMonth, day);
    const sel = wpSelectedMonday && isInWeek(d, wpSelectedMonday);
    html += `<div class="wp-day${sel ? ' selected' : ''}" data-date="${d.toISOString()}">${day}</div>`;
  }

  // Fill trailing days
  const totalCells = startDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(wpViewYear, wpViewMonth + 1, i);
    const sel = wpSelectedMonday && isInWeek(d, wpSelectedMonday);
    html += `<div class="wp-day other-month${sel ? ' selected' : ''}" data-date="${d.toISOString()}">${i}</div>`;
  }

  grid.innerHTML = html;

  // Click handler — select the whole week
  grid.querySelectorAll('.wp-day').forEach(cell => {
    cell.addEventListener('click', () => {
      const clickedDate = new Date(cell.dataset.date);
      wpSelectedMonday = getMondayOfWeek(clickedDate);
      // Store as YYYY-MM-DD
      const y = wpSelectedMonday.getFullYear();
      const m = String(wpSelectedMonday.getMonth() + 1).padStart(2, '0');
      const dd = String(wpSelectedMonday.getDate()).padStart(2, '0');
      document.getElementById('ef-start').value = `${y}-${m}-${dd}`;
      const sun = new Date(wpSelectedMonday);
      sun.setDate(sun.getDate() + 6);
      document.getElementById('wp-selection').textContent =
        `Settimana: ${wpSelectedMonday.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} — ${sun.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      renderWeekPicker();
    });

    // Hover: highlight entire week
    cell.addEventListener('mouseenter', () => {
      const hoverDate = new Date(cell.dataset.date);
      const hoverMonday = getMondayOfWeek(hoverDate);
      grid.querySelectorAll('.wp-day').forEach(c => {
        const d = new Date(c.dataset.date);
        c.classList.toggle('week-hover', !wpSelectedMonday || !isInWeek(d, wpSelectedMonday) ? isInWeek(d, hoverMonday) : false);
      });
    });
  });

  grid.addEventListener('mouseleave', () => {
    grid.querySelectorAll('.wp-day').forEach(c => c.classList.remove('week-hover'));
  });
}

function showEventForm() {
  ['view-events', 'view-event-detail', 'view-presences-overview'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('view-event-form').classList.remove('hidden');
  document.getElementById('ef-name').value = '';
  document.getElementById('ef-start').value = '';
  document.getElementById('ef-weeks').value = '1';
  document.getElementById('wp-selection').textContent = '';
  initWeekPicker();
}

async function createEvent() {
  const name = document.getElementById('ef-name').value.trim();
  const startDate = document.getElementById('ef-start').value;
  const numWeeks = parseInt(document.getElementById('ef-weeks').value) || 1;

  if (!name) { toast('Inserisci un nome per l\'evento', 'error'); return; }
  if (!startDate) { toast('Seleziona una settimana di inizio', 'error'); return; }

  const baseGroups = autoAssignGroups(state.people);
  const weekGroups = {};
  for (let w = 1; w <= numWeeks; w++) {
    weekGroups[w] = JSON.parse(JSON.stringify(baseGroups));
  }

  const event = {
    id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
    name,
    startDate,
    numWeeks,
    weekGroups
  };

  state.events.push(event);
  await dbPutTo(EVENTS_STORE, event);
  toast(`Evento "${name}" creato con ${baseGroups.length} gruppi`, 'success');

  document.getElementById('view-event-form').classList.add('hidden');
  showEventDetail(event.id);
}

function showEventDetail(eventId) {
  state.currentEventId = eventId;
  const event = getCurrentEvent();
  if (!event) return;

  getWeekGroups(event, 1);

  state.currentWeek = getCurrentWeekNumber(event);

  ['view-events', 'view-event-form', 'view-presences-overview'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('view-event-detail').classList.remove('hidden');
  document.getElementById('event-detail-title').textContent = event.name;

  renderWeekTabs();
  renderEventSubView();
}

function renderWeekTabs() {
  const event = getCurrentEvent();
  if (!event) return;
  const container = document.getElementById('week-tabs');
  container.innerHTML = '';

  // Group weeks by month
  const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  const monthGroups = {};

  for (let w = 1; w <= event.numWeeks; w++) {
    const monday = getWeekStartMonday(event, w);
    const saturday = new Date(monday);
    saturday.setDate(saturday.getDate() + 5);
    const monthKey = monday.getMonth();
    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = { name: monthNames[monthKey], weeks: [] };
    }
    const startDay = monday.getDate();
    const endDay = saturday.getDate();
    const startMonth = monthNames[monday.getMonth()].substring(0, 3).toLowerCase();
    const endMonth = monthNames[saturday.getMonth()].substring(0, 3).toLowerCase();
    const rangeLabel = monday.getMonth() === saturday.getMonth()
      ? `${startDay} - ${endDay} ${startMonth}`
      : `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    monthGroups[monthKey].weeks.push({ weekNum: w, label: rangeLabel, monday });
  }

  // Build table-like structure: months as columns, weeks as rows
  const months = Object.values(monthGroups);
  const maxRows = Math.max(...months.map(m => m.weeks.length));

  let html = '<div class="week-tabs-table"><div class="week-tabs-header">';
  months.forEach(m => {
    html += `<div class="week-tabs-month-header">${m.name.toUpperCase()}</div>`;
  });
  html += '</div>';

  for (let row = 0; row < maxRows; row++) {
    html += '<div class="week-tabs-row">';
    months.forEach(m => {
      const week = m.weeks[row];
      if (week) {
        const active = week.weekNum === state.currentWeek ? ' active' : '';
        html += `<div class="week-tabs-cell${active}" data-week="${week.weekNum}">${week.label}</div>`;
      } else {
        html += '<div class="week-tabs-cell empty"></div>';
      }
    });
    html += '</div>';
  }
  html += '</div>';

  container.innerHTML = html;

  // Bind click events
  container.querySelectorAll('.week-tabs-cell[data-week]').forEach(cell => {
    cell.addEventListener('click', () => {
      const w = parseInt(cell.dataset.week);
      state.currentWeek = w;
      container.querySelectorAll('.week-tabs-cell').forEach(c => c.classList.remove('active'));
      cell.classList.add('active');
      renderEventSubView();
    });
  });
}

function renderEventSubView() {
  if (state.eventSubView === 'groups') {
    document.getElementById('event-groups-view').classList.remove('hidden');
    document.getElementById('event-presences-view').classList.add('hidden');
    renderGroups();
  } else {
    document.getElementById('event-groups-view').classList.add('hidden');
    document.getElementById('event-presences-view').classList.remove('hidden');
    renderPresences();
  }
}

// ============================================================
// Groups rendering & drag-and-drop
// ============================================================
function renderGroups() {
  const event = getCurrentEvent();
  if (!event) return;
  const container = document.getElementById('groups-container');
  const groups = getWeekGroups(event, state.currentWeek);

  const assignedIds = getAllMemberIdsForWeek(event, state.currentWeek);
  const unassigned = state.people.filter(p => !assignedIds.has(p.id));

  let html = '';

  html += groups.map((group, gIdx) => {
    const members = group.memberIds.map(id => getPersonById(id)).filter(Boolean);
    const descriptionsHtml = group.descriptions.map((desc, dIdx) => {
      const removeBtn = dIdx > 0
        ? `<button class="member-remove" data-action="remove-desc" data-group-idx="${gIdx}" data-desc-idx="${dIdx}" title="Rimuovi riga">✕</button>`
        : '';
      return `<div style="display:flex;align-items:center;gap:4px;"><input type="text" data-group-idx="${gIdx}" data-desc-idx="${dIdx}" class="group-desc-input" value="${escapeHtml(desc)}" placeholder="Es: Capitano - Nome..." style="flex:1;" />${removeBtn}</div>`;
    }).join('');

    const membersHtml = members.map(p => {
      const ageLabel = p.eta != null ? `(${p.eta} anni)` : '';
      return `
        <div class="group-member" draggable="true" data-person-id="${escapeHtml(p.id)}" data-group-idx="${gIdx}">
          <span class="member-name">${escapeHtml(p.nome)}</span>
          <span class="member-age">${ageLabel}</span>
          <button class="member-remove" data-action="remove-member" data-person-id="${escapeHtml(p.id)}" data-group-idx="${gIdx}" title="Rimuovi dal gruppo">✕</button>
        </div>
      `;
    }).join('');

    return `
      <div class="group-card" data-group-idx="${gIdx}">
        <div class="group-card-header">
          <input type="text" class="group-name-input" data-group-idx="${gIdx}" value="${escapeHtml(group.name)}" />
        </div>
        <div class="group-member-count">${members.length} persone</div>
        <div class="group-descriptions">
          <div class="desc-label">Capitani / Note:</div>
          ${descriptionsHtml}
        </div>
        <div class="group-members-list" data-group-idx="${gIdx}">
          ${membersHtml || '<div style="color:var(--muted);font-size:13px;padding:8px;">Trascina qui una persona</div>'}
        </div>
      </div>
    `;
  }).join('');

  if (unassigned.length > 0) {
    const unassignedHtml = unassigned.map(p => {
      const ageLabel = p.eta != null ? `(${p.eta} anni)` : '';
      return `
        <div class="group-member" draggable="true" data-person-id="${escapeHtml(p.id)}" data-group-idx="-1">
          <span class="member-name">${escapeHtml(p.nome)}</span>
          <span class="member-age">${ageLabel}</span>
        </div>
      `;
    }).join('');
    html += `
      <div class="unassigned-list">
        <h4>Non assegnati (${unassigned.length})</h4>
        <div class="group-members-list" data-group-idx="-1">
          ${unassignedHtml}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;

  setupDragAndDrop();
}

function setupDragAndDrop() {
  const container = document.getElementById('groups-container');

  container.addEventListener('dragstart', (e) => {
    const member = e.target.closest('.group-member[draggable]');
    if (!member) return;
    member.classList.add('dragging');
    e.dataTransfer.setData('text/plain', JSON.stringify({
      personId: member.dataset.personId,
      fromGroupIdx: parseInt(member.dataset.groupIdx)
    }));
    e.dataTransfer.effectAllowed = 'move';
  });

  container.addEventListener('dragend', (e) => {
    const member = e.target.closest('.group-member');
    if (member) member.classList.remove('dragging');
    container.querySelectorAll('.group-card.drag-over').forEach(c => c.classList.remove('drag-over'));
  });

  container.addEventListener('dragover', (e) => {
    const card = e.target.closest('.group-card');
    if (card) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      card.classList.add('drag-over');
    }
  });

  container.addEventListener('dragleave', (e) => {
    const card = e.target.closest('.group-card');
    if (card && !card.contains(e.relatedTarget)) {
      card.classList.remove('drag-over');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    const card = e.target.closest('.group-card');
    if (!card) return;
    card.classList.remove('drag-over');

    const toGroupIdx = parseInt(card.dataset.groupIdx);
    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    const { personId, fromGroupIdx } = data;

    const event = getCurrentEvent();
    if (!event) return;
    const groups = getWeekGroups(event, state.currentWeek);

    if (fromGroupIdx >= 0 && groups[fromGroupIdx]) {
      groups[fromGroupIdx].memberIds = groups[fromGroupIdx].memberIds.filter(id => id !== personId);
    }

    if (toGroupIdx >= 0 && groups[toGroupIdx]) {
      if (!groups[toGroupIdx].memberIds.includes(personId)) {
        groups[toGroupIdx].memberIds.push(personId);
      }
    }

    await dbPutTo(EVENTS_STORE, event);
    renderGroups();
  });

  container.addEventListener('input', async (e) => {
    if (e.target.classList.contains('group-name-input')) {
      const gIdx = parseInt(e.target.dataset.groupIdx);
      const event = getCurrentEvent();
      const groups = getWeekGroups(event, state.currentWeek);
      if (event && groups[gIdx]) {
        groups[gIdx].name = e.target.value;
        await dbPutTo(EVENTS_STORE, event);
      }
    }
    if (e.target.classList.contains('group-desc-input')) {
      const gIdx = parseInt(e.target.dataset.groupIdx);
      const dIdx = parseInt(e.target.dataset.descIdx);
      const event = getCurrentEvent();
      const groups = getWeekGroups(event, state.currentWeek);
      if (event && groups[gIdx]) {
        groups[gIdx].descriptions[dIdx] = e.target.value;
        await dbPutTo(EVENTS_STORE, event);
      }
    }
  });

  container.addEventListener('focusout', async (e) => {
    if (!e.target.classList.contains('group-desc-input')) return;
    const gIdx = parseInt(e.target.dataset.groupIdx);
    const dIdx = parseInt(e.target.dataset.descIdx);
    const event = getCurrentEvent();
    const groups = getWeekGroups(event, state.currentWeek);
    if (!event || !groups[gIdx]) return;
    const descs = groups[gIdx].descriptions;
    if (dIdx === descs.length - 1 && e.target.value.trim() !== '') {
      descs.push('');
      await dbPutTo(EVENTS_STORE, event);
      renderGroups();
    }
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="remove-member"]');
    if (!btn) return;
    e.stopPropagation();
    const personId = btn.dataset.personId;
    const gIdx = parseInt(btn.dataset.groupIdx);
    const event = getCurrentEvent();
    const groups = getWeekGroups(event, state.currentWeek);
    if (event && groups[gIdx]) {
      groups[gIdx].memberIds = groups[gIdx].memberIds.filter(id => id !== personId);
      await dbPutTo(EVENTS_STORE, event);
      renderGroups();
    }
  });

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="remove-desc"]');
    if (!btn) return;
    e.stopPropagation();
    const gIdx = parseInt(btn.dataset.groupIdx);
    const dIdx = parseInt(btn.dataset.descIdx);
    if (dIdx === 0) return;
    const event = getCurrentEvent();
    const groups = getWeekGroups(event, state.currentWeek);
    if (event && groups[gIdx]) {
      groups[gIdx].descriptions.splice(dIdx, 1);
      await dbPutTo(EVENTS_STORE, event);
      renderGroups();
    }
  });
}

// ============================================================
// Add person to group modal
// ============================================================
function showAddToGroupModal() {
  const event = getCurrentEvent();
  if (!event) return;

  const groups = getWeekGroups(event, state.currentWeek);
  const assignedIds = getAllMemberIdsForWeek(event, state.currentWeek);
  const unassigned = state.people.filter(p => !assignedIds.has(p.id));

  const personSelect = document.getElementById('atg-person');
  const groupSelect = document.getElementById('atg-group');

  personSelect.innerHTML = '<option value="">— Seleziona persona —</option>' +
    unassigned.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.nome)}${p.eta != null ? ` (${p.eta} anni)` : ''}</option>`).join('') +
    (unassigned.length === 0 ? '<option value="" disabled>Tutte le persone sono già assegnate</option>' : '');

  groupSelect.innerHTML = groups.map((g, i) => `<option value="${i}">${escapeHtml(g.name)}</option>`).join('');

  const modal = document.getElementById('add-to-group-modal');
  modal.classList.add('show');
  setTimeout(() => personSelect.focus(), 50);
}

function hideAddToGroupModal() {
  document.getElementById('add-to-group-modal').classList.remove('show');
}

async function confirmAddToGroup() {
  const personId = document.getElementById('atg-person').value;
  const groupIdx = parseInt(document.getElementById('atg-group').value);
  const event = getCurrentEvent();

  if (!personId || !event || isNaN(groupIdx)) {
    toast('Seleziona persona e gruppo', 'error');
    return;
  }

  const groups = getWeekGroups(event, state.currentWeek);
  groups.forEach(g => {
    g.memberIds = g.memberIds.filter(id => id !== personId);
  });

  groups[groupIdx].memberIds.push(personId);
  await dbPutTo(EVENTS_STORE, event);
  hideAddToGroupModal();
  renderGroups();
  toast('Persona aggiunta al gruppo', 'success');
}

// ============================================================
// Presences — Day-level (Mon-Sat)
// ============================================================
function getPresenceKey(eventId, weekNum, personId) {
  return `${eventId}_w${weekNum}_${personId}`;
}

function getPresenceDays(eventId, weekNum, personId) {
  const key = getPresenceKey(eventId, weekNum, personId);
  const record = state.presences.find(pr => pr.id === key);
  const empty = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
  if (!record) return empty;
  if (record.days) return { ...empty, ...record.days };
  const val = record.present === true;
  return { 1: val, 2: val, 3: val, 4: val, 5: val, 6: val };
}

function isDayPresent(eventId, weekNum, personId, day) {
  return getPresenceDays(eventId, weekNum, personId)[day] === true;
}

function countDaysPresent(eventId, weekNum, personId) {
  const days = getPresenceDays(eventId, weekNum, personId);
  return Object.values(days).filter(v => v === true).length;
}

function isPresent(eventId, weekNum, personId) {
  const days = getPresenceDays(eventId, weekNum, personId);
  return Object.values(days).some(v => v === true);
}

function isWeekFullyPresent(eventId, weekNum, personId) {
  const days = getPresenceDays(eventId, weekNum, personId);
  return Object.values(days).every(v => v === true);
}

async function toggleDayPresence(eventId, weekNum, personId, day) {
  const key = getPresenceKey(eventId, weekNum, personId);
  let record = state.presences.find(pr => pr.id === key);

  if (record) {
    if (!record.days) {
      const val = record.present === true;
      record.days = { 1: val, 2: val, 3: val, 4: val, 5: val, 6: val };
      delete record.present;
    }
    record.days[day] = !record.days[day];
    record.markedAt = new Date().toISOString();
  } else {
    record = {
      id: key,
      eventId,
      weekNumber: weekNum,
      personId,
      days: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false },
      markedAt: new Date().toISOString()
    };
    record.days[day] = true;
    state.presences.push(record);
  }

  await dbPutTo(PRESENCES_STORE, record);
}

async function toggleAllDays(eventId, weekNum, personId) {
  const key = getPresenceKey(eventId, weekNum, personId);
  const currentDays = getPresenceDays(eventId, weekNum, personId);
  const allPresent = Object.values(currentDays).every(v => v === true);
  const newVal = !allPresent;

  let record = state.presences.find(pr => pr.id === key);
  if (record) {
    record.days = { 1: newVal, 2: newVal, 3: newVal, 4: newVal, 5: newVal, 6: newVal };
    delete record.present;
    record.markedAt = new Date().toISOString();
  } else {
    record = {
      id: key,
      eventId,
      weekNumber: weekNum,
      personId,
      days: { 1: newVal, 2: newVal, 3: newVal, 4: newVal, 5: newVal, 6: newVal },
      markedAt: new Date().toISOString()
    };
    state.presences.push(record);
  }

  await dbPutTo(PRESENCES_STORE, record);
}

async function togglePresence(eventId, weekNum, personId) {
  await toggleAllDays(eventId, weekNum, personId);
}

// ============================================================
// Presences rendering — day-level checkboxes
// ============================================================
function renderPresences() {
  const event = getCurrentEvent();
  if (!event) return;
  const container = document.getElementById('presence-grid');
  const week = state.currentWeek;
  const groups = getWeekGroups(event, week);

  let html = '<table><thead><tr>';
  html += '<th>Gruppo / Persona</th>';
  html += '<th class="day-header" title="Seleziona tutti i giorni">Tutti</th>';
  for (let d = 1; d <= DAY_COUNT; d++) {
    html += `<th class="day-header">${DAY_NAMES[d - 1]}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const group of groups) {
    html += `<tr style="background:#f0f0f0;"><td colspan="${DAY_COUNT + 2}"><strong>${escapeHtml(group.name)}</strong> (${group.memberIds.length})</td></tr>`;

    for (const memberId of group.memberIds) {
      const person = getPersonById(memberId);
      if (!person) continue;
      const days = getPresenceDays(event.id, week, memberId);
      const allChecked = Object.values(days).every(v => v === true);

      html += '<tr>';
      html += `<td>${escapeHtml(person.nome)}${person.eta != null ? ` <span style="color:var(--muted);font-size:12px;">(${person.eta} anni)</span>` : ''}</td>`;
      html += `<td style="text-align:center;"><input type="checkbox" class="select-all-check presence-check-all" data-event-id="${escapeHtml(event.id)}" data-week="${week}" data-person-id="${escapeHtml(memberId)}" ${allChecked ? 'checked' : ''} title="Tutti i giorni" /></td>`;
      for (let d = 1; d <= DAY_COUNT; d++) {
        html += `<td style="text-align:center;"><input type="checkbox" class="presence-check" data-event-id="${escapeHtml(event.id)}" data-week="${week}" data-person-id="${escapeHtml(memberId)}" data-day="${d}" ${days[d] ? 'checked' : ''} /></td>`;
      }
      html += '</tr>';
    }
  }

  const allMembers = groups.flatMap(g => g.memberIds);
  const presentCount = allMembers.filter(id => isPresent(event.id, week, id)).length;
  html += `<tr class="presence-summary-row"><td>Totale presenti</td><td colspan="${DAY_COUNT + 1}" style="text-align:center;">${presentCount} / ${allMembers.length}</td></tr>`;
  html += '</tbody></table>';

  html += '<div style="margin-top:12px;"><button id="btn-presences-overview" class="ghost">📊 Riepilogo completo</button></div>';

  container.innerHTML = html;

  container.querySelectorAll('.presence-check').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const { eventId, week: w, personId, day } = e.target.dataset;
      await toggleDayPresence(eventId, parseInt(w), personId, parseInt(day));
      updatePresenceRow(container, event, parseInt(w), personId, groups);
    });
  });

  container.querySelectorAll('.presence-check-all').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const { eventId, week: w, personId } = e.target.dataset;
      await toggleAllDays(eventId, parseInt(w), personId);
      updatePresenceRow(container, event, parseInt(w), personId, groups);
    });
  });

  const overviewBtn = container.querySelector('#btn-presences-overview');
  if (overviewBtn) {
    overviewBtn.addEventListener('click', () => showPresencesOverview());
  }
}

function updatePresenceRow(container, event, week, personId, groups) {
  const days = getPresenceDays(event.id, week, personId);
  const allChecked = Object.values(days).every(v => v === true);

  for (let d = 1; d <= DAY_COUNT; d++) {
    const cb = container.querySelector(`.presence-check[data-person-id="${personId}"][data-day="${d}"]`);
    if (cb) cb.checked = days[d] === true;
  }
  const allCb = container.querySelector(`.presence-check-all[data-person-id="${personId}"]`);
  if (allCb) allCb.checked = allChecked;

  const allMembers = groups.flatMap(g => g.memberIds);
  const cnt = allMembers.filter(id => isPresent(event.id, week, id)).length;
  const summaryCell = container.querySelector('.presence-summary-row td:last-child');
  if (summaryCell) summaryCell.textContent = `${cnt} / ${allMembers.length}`;
}

// ============================================================
// Presences overview — clickable week cells + modal
// ============================================================
function showPresencesOverview() {
  const event = getCurrentEvent();
  if (!event) return;

  document.getElementById('view-event-detail').classList.add('hidden');
  document.getElementById('view-presences-overview').classList.remove('hidden');

  const container = document.getElementById('presences-overview-content');

  const memberMap = new Map();
  for (let w = 1; w <= event.numWeeks; w++) {
    const groups = getWeekGroups(event, w);
    for (const g of groups) {
      for (const id of g.memberIds) {
        if (!memberMap.has(id)) {
          memberMap.set(id, g.name);
        }
      }
    }
  }

  const allMembers = Array.from(memberMap.entries()).map(([id, groupName]) => ({ id, groupName }));

  let html = '<table><thead><tr><th>Persona</th><th>Gruppo</th>';
  for (let w = 1; w <= event.numWeeks; w++) {
    html += `<th>S${w}</th>`;
  }
  html += '<th>Totale</th><th class="no-print"></th></tr></thead><tbody>';

  for (const { id, groupName } of allMembers) {
    const person = getPersonById(id);
    if (!person) continue;
    let totalDays = 0;
    const totalPossibleDays = event.numWeeks * DAY_COUNT;

    html += `<tr><td>${escapeHtml(person.nome)}</td><td style="font-size:12px;color:var(--muted);">${escapeHtml(groupName)}</td>`;

    for (let w = 1; w <= event.numWeeks; w++) {
      const daysPresent = countDaysPresent(event.id, w, id);
      totalDays += daysPresent;
      const fullyPresent = daysPresent === DAY_COUNT;
      const partiallyPresent = daysPresent > 0 && daysPresent < DAY_COUNT;

      let symbol, title;
      if (fullyPresent) {
        symbol = '✅';
        title = 'Presente tutti i giorni';
      } else if (partiallyPresent) {
        symbol = `⚠️ ${daysPresent}/${DAY_COUNT}`;
        title = `Presente ${daysPresent} su ${DAY_COUNT} giorni`;
      } else {
        symbol = '❌';
        title = 'Assente tutta la settimana';
      }

      html += `<td class="presence-cell-clickable" data-action="show-week-detail" data-person-id="${escapeHtml(id)}" data-week="${w}" data-event-id="${escapeHtml(event.id)}" title="${title}">${symbol}</td>`;
    }

    html += `<td style="text-align:center;font-weight:600;">${totalDays}/${totalPossibleDays}</td>`;
    html += `<td class="no-print" style="text-align:center;"><button class="btn-print" data-action="print-person" data-person-id="${escapeHtml(id)}" data-event-id="${escapeHtml(event.id)}" title="Stampa dettaglio persona">🖨️</button></td>`;
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('[data-action="show-week-detail"]').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const { personId, week, eventId } = e.currentTarget.dataset;
      showWeekDetailModal(eventId, parseInt(week), personId);
    });
  });

  // Print person detail
  container.querySelectorAll('[data-action="print-person"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { personId, eventId } = e.currentTarget.dataset;
      printPersonDetail(eventId, personId);
    });
  });
}

function showWeekDetailModal(eventId, weekNum, personId) {
  const person = getPersonById(personId);
  if (!person) return;

  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  const startDate = getWeekStartMonday(event, weekNum);

  const modal = document.getElementById('week-detail-modal');
  const title = document.getElementById('week-detail-modal-title');
  const content = document.getElementById('week-detail-modal-content');

  title.textContent = `${person.nome} — Settimana ${weekNum}`;

  const days = getPresenceDays(eventId, weekNum, personId);
  const daysPresent = countDaysPresent(eventId, weekNum, personId);

  let html = '<table class="week-detail-table"><thead><tr><th>Giorno</th><th>Data</th><th>Presente</th></tr></thead><tbody>';

  for (let d = 1; d <= DAY_COUNT; d++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(dayDate.getDate() + (d - 1));
    const dateStr = dayDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
    const present = days[d] === true;

    html += `<tr>
      <td>${DAY_NAMES[d - 1]}</td>
      <td style="font-size:12px;color:var(--muted);">${dateStr}</td>
      <td style="text-align:center;">${present ? '✅' : '❌'}</td>
    </tr>`;
  }

  html += '</tbody></table>';
  html += `<div style="margin-top:12px;font-weight:600;">Totale: ${daysPresent}/${DAY_COUNT} giorni</div>`;

  content.innerHTML = html;
  modal.classList.add('show');
}

// ============================================================
// Print functions
// ============================================================

/** Print the full Riepilogo Presenze overview */
function printOverview() {
  const event = getCurrentEvent();
  if (!event) return;

  const memberMap = new Map();
  for (let w = 1; w <= event.numWeeks; w++) {
    const groups = getWeekGroups(event, w);
    for (const g of groups) {
      for (const id of g.memberIds) {
        if (!memberMap.has(id)) memberMap.set(id, g.name);
      }
    }
  }
  const allMembers = Array.from(memberMap.entries()).map(([id, groupName]) => ({ id, groupName }));

  let html = `<h1>📊 Riepilogo Presenze — ${escapeHtml(event.name)}</h1>`;
  html += `<h2>Dal ${fmtDateDisplay(event.startDate)} · ${event.numWeeks} settimane</h2>`;
  html += '<table><thead><tr><th>Persona</th><th>Gruppo</th>';
  for (let w = 1; w <= event.numWeeks; w++) html += `<th>S${w}</th>`;
  html += '<th>Totale</th></tr></thead><tbody>';

  for (const { id, groupName } of allMembers) {
    const person = getPersonById(id);
    if (!person) continue;
    let totalDays = 0;
    const totalPossible = event.numWeeks * DAY_COUNT;
    html += `<tr><td>${escapeHtml(person.nome)}</td><td class="muted">${escapeHtml(groupName)}</td>`;
    for (let w = 1; w <= event.numWeeks; w++) {
      const dp = countDaysPresent(event.id, w, id);
      totalDays += dp;
      const sym = dp === DAY_COUNT ? '✅' : dp > 0 ? `⚠️ ${dp}/${DAY_COUNT}` : '❌';
      html += `<td class="center">${sym}</td>`;
    }
    html += `<td class="center">${totalDays}/${totalPossible}</td></tr>`;
  }
  html += '</tbody></table>';

  printContent(`Riepilogo Presenze — ${event.name}`, html);
}

/** Print the day-level detail for a person in a specific week */
function printWeekDetail() {
  const modal = document.getElementById('week-detail-modal');
  if (!modal.classList.contains('show')) return;
  const titleText = document.getElementById('week-detail-modal-title').textContent;
  const contentHtml = document.getElementById('week-detail-modal-content').innerHTML;
  printContent(titleText, `<h1>${escapeHtml(titleText)}</h1>${contentHtml}`);
}

/** Print full detail for a single person across all weeks */
function printPersonDetail(eventId, personId) {
  const event = state.events.find(e => e.id === eventId);
  const person = getPersonById(personId);
  if (!event || !person) return;

  let html = `<h1>Dettaglio Presenze — ${escapeHtml(person.nome)}</h1>`;
  html += `<h2>${escapeHtml(event.name)} · ${event.numWeeks} settimane</h2>`;

  let grandTotal = 0;
  const grandPossible = event.numWeeks * DAY_COUNT;

  for (let w = 1; w <= event.numWeeks; w++) {
    const startDate = getWeekStartMonday(event, w);
    const days = getPresenceDays(eventId, w, personId);
    const dp = countDaysPresent(eventId, w, personId);
    grandTotal += dp;

    html += `<h3 style="margin:16px 0 4px;font-size:14px;">Settimana ${w} — ${startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</h3>`;
    html += '<table><thead><tr><th>Giorno</th><th>Data</th><th>Presente</th></tr></thead><tbody>';
    for (let d = 1; d <= DAY_COUNT; d++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + (d - 1));
      const dateStr = dayDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
      html += `<tr><td>${DAY_NAMES[d - 1]}</td><td class="muted">${dateStr}</td><td class="center">${days[d] ? '✅' : '❌'}</td></tr>`;
    }
    html += `</tbody></table>`;
    html += `<div class="summary">Settimana ${w}: ${dp}/${DAY_COUNT} giorni</div>`;
  }

  html += `<div class="summary" style="margin-top:20px;font-size:15px;border-top:2px solid #d1d5db;padding-top:12px;">Totale complessivo: ${grandTotal}/${grandPossible} giorni</div>`;

  printContent(`Presenze ${person.nome}`, html);
}

function hideWeekDetailModal() {
  document.getElementById('week-detail-modal').classList.remove('show');
}

// ============================================================
// Presence button in main table
// ============================================================
function getActiveEvent() {
  if (state.events.length === 0) return null;
  return state.events[state.events.length - 1];
}

function getCurrentDayOfWeek(event) {
  if (!event) return null;
  const now = new Date();
  const jsDay = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
  if (jsDay === 0) return null; // Sunday — no camp day
  const dayNum = jsDay; // 1=Mon,...,6=Sat — matches DAY_COUNT (1-6)
  if (dayNum > DAY_COUNT) return null;
  return dayNum;
}

function renderPresenceColumn(personId) {
  const event = getActiveEvent();
  if (!event) return '';
  const week = getCurrentWeekNumber(event);
  const day = getCurrentDayOfWeek(event);
  const present = day ? isDayPresent(event.id, week, personId, day) : isPresent(event.id, week, personId);
  return `<td style="text-align:center;">
    <button class="btn-present ${present ? 'marked' : ''}" data-action="toggle-main-presence" data-person-id="${escapeHtml(personId)}" data-event-id="${escapeHtml(event.id)}" data-week="${week}" data-day="${day || ''}">
      ${present ? '✅ Presente' : '📋 Segna'}
    </button>
  </td>`;
}
