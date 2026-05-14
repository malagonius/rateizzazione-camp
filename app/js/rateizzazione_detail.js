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

// Bind input events on detail view (event delegation)
function bindDetailEvents() {
  // Top-level fields
  const map = {
    'd-nome': 'nome',
    'd-telefono': 'telefono',
    'd-totale': 'totale',
    'd-dataIscrizione': 'dataIscrizione',
    'd-eta': 'eta',
    'd-assistenza': 'assistenza'
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
}
