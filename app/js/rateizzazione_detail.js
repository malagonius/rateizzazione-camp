/* ============================================================
 * rateizzazione_detail.js — Detail view rendering & events
 * ============================================================ */

function showDetail(id) {
  state.currentId = id;
  document.getElementById('view-list').classList.add('hidden');
  document.getElementById('view-detail').classList.remove('hidden');
  document.getElementById('btn-back').classList.remove('hidden');
  renderDetail();
}

function showList() {
  state.currentId = null;
  document.getElementById('view-detail').classList.add('hidden');
  document.getElementById('view-list').classList.remove('hidden');
  document.getElementById('btn-back').classList.add('hidden');
  applyFilters();
}

function getCurrent() {
  return state.people.find(p => p.id === state.currentId);
}

function renderDetail() {
  const p = getCurrent();
  if (!p) { showList(); return; }

  document.getElementById('detail-title').textContent = p.nome || 'Nuova persona';
  document.getElementById('d-nome').value = p.nome || '';
  document.getElementById('d-telefono').value = p.telefono || '';
  document.getElementById('d-totale').value = p.totale || 0;
  document.getElementById('d-dataIscrizione').value = p.dataIscrizione || '';
  document.getElementById('d-assistenza').value = (p.assistenza === 'Si') ? 'Si' : 'No';
  document.getElementById('d-eta').value = p.eta != null ? p.eta : '';
  document.getElementById('d-allergie').value = p.allergie || '';

  renderEventAssignment();
  renderDetailPurchases(p);
  renderInstallments();
  renderDetailSummary();
}

function renderInstallments() {
  const p = getCurrent();
  const tbody = document.getElementById('installments-tbody');
  tbody.innerHTML = p.installments.map((inst, idx) => {
    const ipotesi = num(inst.ipotesi);
    const reale = num(inst.reale);
    const metodo = inst.metodo || '';
    const iban = inst.iban || '';
    let cls = '';
    if (ipotesi > 0 && reale >= ipotesi - 0.01) cls = 'inst-paid';
    else if (reale > 0) cls = 'inst-partial';
    const ibanValid = !iban || isValidIBAN(iban);
    const ibanField = metodo === 'Bonifico'
      ? `<input type="text" class="iban-input ${ibanValid ? '' : 'invalid'}" data-field="iban" value="${escapeHtml(iban)}" placeholder="IBAN (es. IT60X0542811101000000123456)" maxlength="34" />`
      : '';
    return `
      <tr class="${cls}" data-idx="${idx}">
        <td>
          <input type="text" data-field="label" value="${escapeHtml(inst.label)}" />
        </td>
        <td><input type="number" step="0.01" min="0" data-field="ipotesi" value="${ipotesi || ''}" /></td>
        <td><input type="number" step="0.01" min="0" data-field="reale" value="${reale || ''}" /></td>
        <td><input type="date" data-field="data" value="${inst.data || ''}" /></td>
        <td>
          <select data-field="metodo">
            <option value=""${metodo === '' ? ' selected' : ''}>—</option>
            <option value="Contanti"${metodo === 'Contanti' ? ' selected' : ''}>Contanti</option>
            <option value="Bonifico"${metodo === 'Bonifico' ? ' selected' : ''}>Bonifico</option>
          </select>
          ${ibanField}
        </td>
        <td><button class="danger" data-action="del-inst" title="Elimina rata">✕</button></td>
      </tr>
    `;
  }).join('');
}

// Basic IBAN validation: 2 letters + 2 digits + up to 30 alphanumeric chars
function isValidIBAN(iban) {
  if (!iban) return true;
  const cleaned = String(iban).replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned);
}

function renderDetailSummary() {
  const p = getCurrent();
  const due = num(p.totale);
  const paid = totalPaid(p);
  const residuo = due - paid;
  const status = statusOf(p);
  document.getElementById('sum-totale').textContent = fmtMoney(due);
  document.getElementById('sum-paid').textContent = fmtMoney(paid);
  document.getElementById('sum-residuo').textContent = fmtMoney(residuo);
  document.getElementById('sum-residuo').style.color = residuo > 0.01 ? 'var(--red)' : 'var(--muted)';
  const sumStatus = document.getElementById('sum-status');
  sumStatus.innerHTML = `<span class="badge badge-${status}">${STATUS_LABEL[status]}</span>`;
}

async function persistCurrent() {
  const p = getCurrent();
  if (!p) return;
  await dbPut(p);
}

// ============================================================
// Event assignment — auto-assigned by age, with manual override
// ============================================================
function renderEventAssignment() {
  const p = getCurrent();
  if (!p) return;

  // Auto-assign only if not manually overridden
  if (!p.eventIdManual) {
    const targetEventId = getEventForAge(p.eta);
    if (p.eventId !== targetEventId) {
      p.eventId = targetEventId;
      if (!targetEventId) p.eventWeeks = [];
      persistCurrent();
    }
  }

  const container = document.getElementById('d-event-assignment');

  // Build the event options for the override dropdown
  const evOptions = STATIC_EVENTS.map(tpl => {
    const ev = state.events.find(e => e.id === tpl.id);
    if (!ev) return '';
    const selected = p.eventId === ev.id ? ' selected' : '';
    return `<option value="${escapeHtml(ev.id)}"${selected}>${tpl.emoji} ${escapeHtml(ev.name)}</option>`;
  }).join('');
  const noneSelected = !p.eventId ? ' selected' : '';

  const isManual = !!p.eventIdManual;
  const autoLabel = !p.eventId
    ? `<span style="font-size:12px;color:var(--muted);">Nessuna assegnazione automatica (età: ${p.eta != null ? p.eta : 'non inserita'})</span>`
    : (() => {
        const ev = state.events.find(e => e.id === getEventForAge(p.eta));
        const tpl = ev ? STATIC_EVENTS.find(s => s.id === ev.id) : null;
        return `<span style="font-size:12px;color:var(--muted);">Auto: ${tpl ? tpl.emoji + ' ' + ev.name : '—'} (età: ${p.eta})</span>`;
      })();

  container.innerHTML = `
    <div class="event-assignment-info" style="flex-direction:column;align-items:flex-start;gap:6px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <select id="d-event-override" style="font-size:14px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);">
          <option value=""${noneSelected}>— Nessun evento —</option>
          ${evOptions}
        </select>
        ${isManual
          ? `<button type="button" id="btn-reset-event-auto" class="ghost" style="font-size:12px;" title="Ripristina assegnazione automatica per età">↺ Automatico</button>
             <span class="badge" style="background:#fef3c7;color:#92400e;font-size:11px;">Manuale</span>`
          : `<span class="badge" style="background:#dcfce7;color:#166534;font-size:11px;">Automatico</span>`
        }
      </div>
      ${!isManual ? autoLabel : ''}
    </div>
  `;

  if (!p.eventId) {
    document.getElementById('d-event-weeks').innerHTML = '';
  } else {
    renderEventWeeks();
  }
}

function renderEventWeeks() {
  const p = getCurrent();
  const container = document.getElementById('d-event-weeks');
  if (!p || !p.eventId) {
    container.innerHTML = '';
    return;
  }

  const event = state.events.find(ev => ev.id === p.eventId);
  if (!event) {
    container.innerHTML = '';
    return;
  }

  const weeks = p.eventWeeks || [];

  const weekText = weeks.length ? weeks.map(w => `S${w}`).join(', ') : 'Nessuna settimana acquistata';
  let html = '<div class="event-weeks-label">Settimane di partecipazione:</div>';
  html += `<div class="empty-inline">${escapeHtml(weekText)} · gestite dalla scheda Acquisti.</div>`;
  container.innerHTML = html;
}

// Bind input events on detail view (event delegation)
function bindDetailEvents() {
  // Top-level fields
  const map = {
    'd-nome': 'nome',
    'd-telefono': 'telefono',
    'd-totale': 'totale',
    'd-dataIscrizione': 'dataIscrizione',
    'd-eta': 'eta',
    'd-assistenza': 'assistenza',
    'd-allergie': 'allergie'
  };
  Object.entries(map).forEach(([id, field]) => {
    document.getElementById(id).addEventListener('input', async (e) => {
      const p = getCurrent();
      if (!p) return;
      let v = e.target.value;
      if (field === 'totale') v = num(v);
      if (field === 'eta') v = v === '' ? null : num(v);
      p[field] = v;
      if (field === 'nome') document.getElementById('detail-title').textContent = v || 'Nuova persona';
      if (field === 'eta') renderEventAssignment();
      renderDetailSummary();
      await persistCurrent();
    });
  });

  // Installments table — delegate
  document.getElementById('installments-tbody').addEventListener('input', async (e) => {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = +tr.dataset.idx;
    const field = e.target.dataset.field;
    const p = getCurrent();
    if (!p || !p.installments[idx]) return;
    let v = e.target.value;
    if (field === 'ipotesi' || field === 'reale') v = num(v);
    if (field === 'iban') v = String(v).toUpperCase();
    p.installments[idx][field] = v;
    // Live IBAN validation feedback
    if (field === 'iban') {
      e.target.classList.toggle('invalid', !isValidIBAN(v));
    }
    // Re-color row without full re-render to preserve focus
    const ipotesi = num(p.installments[idx].ipotesi);
    const reale = num(p.installments[idx].reale);
    tr.className = '';
    if (ipotesi > 0 && reale >= ipotesi - 0.01) tr.className = 'inst-paid';
    else if (reale > 0) tr.className = 'inst-partial';
    renderDetailSummary();
    await persistCurrent();
  });

  // Handle metodo select change (needs change event for selects + re-render to show/hide IBAN)
  document.getElementById('installments-tbody').addEventListener('change', async (e) => {
    if (e.target.dataset.field !== 'metodo') return;
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = +tr.dataset.idx;
    const p = getCurrent();
    if (!p || !p.installments[idx]) return;
    p.installments[idx].metodo = e.target.value;
    if (e.target.value !== 'Bonifico') {
      p.installments[idx].iban = '';
    }
    await persistCurrent();
    renderInstallments();
  });

  document.getElementById('installments-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="del-inst"]');
    if (!btn) return;
    const tr = btn.closest('tr[data-idx]');
    const idx = +tr.dataset.idx;
    const p = getCurrent();
    if (!confirm(`Eliminare la rata "${p.installments[idx].label}"?`)) return;
    p.installments.splice(idx, 1);
    await persistCurrent();
    renderInstallments();
    renderDetailSummary();
  });

  document.getElementById('btn-add-installment').addEventListener('click', async () => {
    const p = getCurrent();
    const label = prompt('Nome della nuova rata:', 'Rata extra');
    if (!label) return;
    p.installments.push({
      key: 'custom_' + Date.now().toString(36),
      label: label.trim(),
      ipotesi: 0,
      reale: 0,
      data: null,
      metodo: '',
      iban: ''
    });
    await persistCurrent();
    renderInstallments();
    renderDetailSummary();
  });

  document.getElementById('btn-delete-person').addEventListener('click', async () => {
    const p = getCurrent();
    if (!p) return;
    if (!confirm(`Eliminare definitivamente "${p.nome}"?`)) return;
    await dbDelete(p.id);
    state.people = state.people.filter(x => x.id !== p.id);
    toast('Persona eliminata', 'success');
    showList();
  });

  document.getElementById('btn-detail-purchases').addEventListener('click', () => {
    const p = getCurrent();
    if (p) showAcquisti(p.id);
  });

  document.getElementById('d-purchases-summary').addEventListener('click', async (e) => {
    const p = getCurrent();
    if (!p) return;
    const removeBtn = e.target.closest('[data-action="remove-detail-purchase"]');
    if (removeBtn) {
      await removePersonPurchase(p.id, removeBtn.dataset.purchaseId);
      return;
    }
    const ticketBtn = e.target.closest('[data-action="use-detail-ticket"]');
    if (!ticketBtn) return;
    const event = getPersonEventForPurchases(p);
    const result = await useTicketForPerson(p, event, event ? getCurrentWeekNumber(event) : null, event ? getCurrentDayOfWeek(event) : null, ticketBtn.dataset.purchaseId);
    if (!result.ok) { toast(result.message, 'error'); return; }
    toast(`Ticket usato. Rimasti: ${getTicketRemainingForPerson(p)}`, 'success');
    renderDetail();
    applyFilters();
  });

  // Manual event override dropdown
  document.getElementById('view-detail').addEventListener('change', async (e) => {
    if (e.target.id !== 'd-event-override') return;
    const p = getCurrent();
    if (!p) return;
    const newEventId = e.target.value || null;
    p.eventId = newEventId;
    p.eventIdManual = true;
    if (!newEventId) p.eventWeeks = [];
    await persistCurrent();
    renderEventAssignment();
  });

  // Reset to automatic assignment
  document.getElementById('view-detail').addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-reset-event-auto');
    if (!btn) return;
    const p = getCurrent();
    if (!p) return;
    p.eventIdManual = false;
    p.eventWeeks = [];
    await persistCurrent();
    renderEventAssignment();
  });

  // Week checkboxes (event delegation)
  document.getElementById('d-event-weeks').addEventListener('change', async (e) => {
    const p = getCurrent();
    if (!p) return;
    const weekNum = parseInt(e.target.dataset.week);
    if (!p.eventWeeks) p.eventWeeks = [];
    if (e.target.checked) {
      if (!p.eventWeeks.includes(weekNum)) p.eventWeeks.push(weekNum);
    } else {
      p.eventWeeks = p.eventWeeks.filter(w => w !== weekNum);
    }
    p.eventWeeks.sort((a, b) => a - b);
    await persistCurrent();
  });

  // Select/deselect all weeks
  document.getElementById('d-event-weeks').addEventListener('click', async (e) => {
    const btn = e.target.closest('#btn-select-all-weeks, #btn-deselect-all-weeks');
    if (!btn) return;
    const p = getCurrent();
    if (!p || !p.eventId) return;
    const event = state.events.find(ev => ev.id === p.eventId);
    if (!event) return;

    if (btn.id === 'btn-select-all-weeks') {
      p.eventWeeks = [];
      for (let w = 1; w <= event.numWeeks; w++) p.eventWeeks.push(w);
    } else {
      p.eventWeeks = [];
    }
    await persistCurrent();
    renderEventWeeks();
  });
}
