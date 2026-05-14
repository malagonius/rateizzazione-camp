/* ============================================================
 * rateizzazione.js — List view, filters, stats, Excel I/O
 * ============================================================ */

// ============================================================
// Excel IMPORT
// Strategy: parse first sheet with header row 1 then map by
// position because headers have ambiguous "DATA" labels.
// Column layout (0-based):
// 0 NOME, 1 TELEFONO, 2 TOTALE, 3 DATA ISCRIZIONE,
// 4 IPOTESI ACCONTO, 5 ACCONTO REALE, 6 DATA,
// 7 IPOTESI MAGGIO, 8 MAGGIO REALE, 9 DATA,
// 10 IPOTESI GIUGNO, 11 GIUGNO REALE, 12 DATA,
// 13 IPOTESI LUGLIO, 14 LUGLIO REALE, 15 DATA,
// 16 IPOTESI AGOSTO, 17 AGOSTO REALE, 18 DATA,
// 19 IPOTESI SETTEMBRE, 20 SETTEMBRE REALE, 21 DATA,
// 22 RESIDUO REALE, 23 ASSISTENZA
// ============================================================
async function importExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!rows.length) throw new Error('Foglio vuoto');

  const people = [];
  // Skip header row (index 0)
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(c => c == null || c === '')) continue;
    const nome = row[0];
    if (!nome || String(nome).trim() === '') continue;

    const installments = DEFAULT_INSTALLMENTS.map((tpl, idx) => {
      // Each installment occupies 3 columns starting at col 4
      const base = 4 + idx * 3;
      return {
        key: tpl.key,
        label: tpl.label,
        ipotesi: num(row[base]),
        reale: num(row[base + 1]),
        data: excelDateToISO(row[base + 2]),
        metodo: '',
        iban: ''
      };
    });

    people.push({
      id: uid(),
      nome: String(nome).trim(),
      telefono: row[1] != null ? String(row[1]).trim() : '',
      totale: num(row[2]),
      dataIscrizione: excelDateToISO(row[3]),
      installments,
      assistenza: normalizeAssistenza(row[23]),
      eta: row[24] != null && row[24] !== '' ? num(row[24]) : null,
      visibilityHidden: false
    });
  }

  await dbClear();
  await dbBulkPut(people);
  state.people = people;

  // Import events & presences if sheets exist
  let importedEvents = [];
  let importedPresences = [];

  if (wb.SheetNames.includes('Eventi')) {
    const wsEv = wb.Sheets['Eventi'];
    const evRows = XLSX.utils.sheet_to_json(wsEv, { header: 1, raw: true, defval: null });
    for (let i = 1; i < evRows.length; i++) {
      const jsonStr = evRows[i]?.[0];
      if (jsonStr) {
        try { importedEvents.push(JSON.parse(jsonStr)); } catch (e) { /* skip invalid */ }
      }
    }
  }

  if (wb.SheetNames.includes('Presenze')) {
    const wsPr = wb.Sheets['Presenze'];
    const prRows = XLSX.utils.sheet_to_json(wsPr, { header: 1, raw: true, defval: null });
    for (let i = 1; i < prRows.length; i++) {
      const jsonStr = prRows[i]?.[0];
      if (jsonStr) {
        try { importedPresences.push(JSON.parse(jsonStr)); } catch (e) { /* skip invalid */ }
      }
    }
  }

  await dbClearStore(EVENTS_STORE);
  await dbClearStore(PRESENCES_STORE);
  if (importedEvents.length) await dbBulkPutTo(EVENTS_STORE, importedEvents);
  if (importedPresences.length) await dbBulkPutTo(PRESENCES_STORE, importedPresences);
  state.events = importedEvents;
  state.presences = importedPresences;

  applyFilters();
  const evMsg = importedEvents.length ? `, ${importedEvents.length} eventi` : '';
  toast(`Importate ${people.length} persone${evMsg}`, 'success');
}

// ============================================================
// Excel EXPORT — preserves original layout
// ============================================================
function exportExcel() {
  const headers = [
    'NOME', 'TELEFONO', 'TOTALE', 'DATA ISCRIZIONE',
    'IPOTESI ACCONTO', 'ACCONTO REALE', 'DATA',
    'IPOTESI RATA MAGGIO', 'RATA MAGGIO REALE', 'DATA',
    'IPOTESI RATA GIUGNO', 'RATA GIUGNO REALE', 'DATA',
    'IPOTESI RATA LUGLIO', 'RATA LUGLIO REALE', 'DATA',
    'IPOTESI RATA AGOSTO', 'RATA AGOSTO REALE', 'DATA',
    'IPOTESI RATA SETTEMBRE', 'RATA SETTEMBRE REALE', 'DATA',
    'RESIDUO REALE', 'ASSISTENZA', 'ETÀ',
    'TOTALE PAGATO', 'STATO'
  ];

  const data = [headers];
  for (const p of state.people) {
    const row = [
      p.nome,
      p.telefono,
      num(p.totale),
      p.dataIscrizione ? new Date(p.dataIscrizione) : null
    ];
    // Map installments by key in default order; extra custom installments are skipped
    for (const tpl of DEFAULT_INSTALLMENTS) {
      const inst = p.installments.find(i => i.key === tpl.key) || {};
      row.push(num(inst.ipotesi) || null);
      row.push(num(inst.reale) || null);
      row.push(inst.data ? new Date(inst.data) : null);
    }
    const paid = totalPaid(p);
    row.push(num(p.totale) - paid); // residuo
    row.push(p.assistenza || '');
    row.push(p.eta != null ? p.eta : '');
    row.push(paid);
    row.push(STATUS_LABEL[statusOf(p)]);
    data.push(row);
  }

  // Append custom (non-default) installments as extra rows? Better: include in a separate sheet.
  const ws = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rateizzazione');

  // Custom installments sheet (anything beyond the 6 defaults)
  const customRows = [['NOME', 'RATA', 'IPOTESI', 'PAGATO REALE', 'DATA']];
  for (const p of state.people) {
    const defaults = new Set(DEFAULT_INSTALLMENTS.map(d => d.key));
    for (const inst of p.installments) {
      if (!defaults.has(inst.key)) {
        customRows.push([
          p.nome, inst.label,
          num(inst.ipotesi) || null,
          num(inst.reale) || null,
          inst.data ? new Date(inst.data) : null
        ]);
      }
    }
  }
  if (customRows.length > 1) {
    const ws2 = XLSX.utils.aoa_to_sheet(customRows, { cellDates: true });
    XLSX.utils.book_append_sheet(wb, ws2, 'Rate aggiuntive');
  }

  // Events sheet — store as JSON rows since data is hierarchical
  if (state.events.length) {
    const evRows = [['JSON_DATA']];
    for (const ev of state.events) {
      evRows.push([JSON.stringify(ev)]);
    }
    const wsEv = XLSX.utils.aoa_to_sheet(evRows);
    XLSX.utils.book_append_sheet(wb, wsEv, 'Eventi');
  }

  // Presences sheet — store as JSON rows
  if (state.presences.length) {
    const prRows = [['JSON_DATA']];
    for (const pr of state.presences) {
      prRows.push([JSON.stringify(pr)]);
    }
    const wsPr = XLSX.utils.aoa_to_sheet(prRows);
    XLSX.utils.book_append_sheet(wb, wsPr, 'Presenze');
  }

  const fname = `rateizzazione_camp_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, fname);
  toast('Excel esportato', 'success');
}

// ============================================================
// LIST view rendering
// ============================================================
function applyFilters() {
  const q = state.search.trim().toLowerCase();
  let arr = state.people.filter(p => {
    if (q) {
      const hay = (p.nome + ' ' + (p.telefono || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.statusFilter) {
      if (state.statusFilter === 'assistenza') {
        if (p.assistenza !== 'Si') return false;
      } else if (statusOf(p) !== state.statusFilter) {
        return false;
      }
    }
    return true;
  });

  // Sort
  const dir = state.sortDir === 'asc' ? 1 : -1;
  arr.sort((a, b) => {
    let av, bv;
    switch (state.sortKey) {
      case 'paid':    av = totalPaid(a); bv = totalPaid(b); break;
      case 'residuo': av = num(a.totale) - totalPaid(a); bv = num(b.totale) - totalPaid(b); break;
      case 'status':  av = statusOf(a); bv = statusOf(b); break;
      case 'totale':  av = num(a.totale); bv = num(b.totale); break;
      case 'telefono':av = a.telefono || ''; bv = b.telefono || ''; break;
      default:        av = (a.nome || '').toLowerCase(); bv = (b.nome || '').toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });

  state.filtered = arr;
  renderList();
  renderStats();
}

function renderList() {
  const tbody = document.getElementById('people-tbody');
  const empty = document.getElementById('empty-state');
  const table = document.getElementById('people-table');

  if (!state.people.length) {
    table.classList.add('hidden');
    empty.classList.remove('hidden');
    tbody.innerHTML = '';
    return;
  }
  table.classList.remove('hidden');
  empty.classList.add('hidden');

  const rowsHtml = state.filtered.map(p => {
    const due = num(p.totale);
    const paid = totalPaid(p);
    const residuo = due - paid;
    const status = statusOf(p);
    const pct = due > 0 ? Math.min(100, (paid / due) * 100) : (paid > 0 ? 100 : 0);
    
    // Row visibility is determined solely by its own state
    const isCensored = !!p.visibilityHidden;
    
    // Eye icon for row-level toggle - reflects this row's state
    const eyeIcon = p.visibilityHidden
      ? `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>`
      : `<svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>`;
    
    const displayDue = isCensored ? '<span class="censored-amount">************</span>' : fmtMoney(due);
    const displayPaid = isCensored ? '<span class="censored-amount">************</span>' : fmtMoney(paid);
    const displayResiduo = isCensored ? '<span class="censored-amount">************</span>' : fmtMoney(residuo);
    const displayPct = isCensored ? 0 : pct;
    const displayStatus = isCensored
      ? '<span class="badge" style="background: #e5e7eb; color: #9ca3af;">Nascosto</span>'
      : `<span class="badge badge-${status}">${STATUS_LABEL[status]}</span>`;
    
    return `
      <tr class="row-${status}" data-id="${escapeHtml(p.id)}">
        <td><strong>${escapeHtml(p.nome)}</strong></td>
        <td>${escapeHtml(p.telefono || '')}</td>
        <td class="num">
          <button class="row-eye-btn" data-action="toggle-row-visibility" data-id="${escapeHtml(p.id)}" title="${p.visibilityHidden ? 'Mostra' : 'Nascondi'} importi riga">${eyeIcon}</button>${displayDue}
        </td>
        <td class="num" style="color: var(--green);">${displayPaid}</td>
        <td class="num" style="color: ${residuo > 0.01 ? 'var(--red)' : 'var(--muted)'};">${displayResiduo}</td>
        <td>
          <div class="progress" title="${displayPct.toFixed(0)}%">
            <div class="progress-bar ${status}" style="width: ${displayPct}%"></div>
          </div>
        </td>
        <td>${displayStatus}</td>
        ${renderPresenceColumn(p.id)}
      </tr>
    `;
  }).join('');
  tbody.innerHTML = rowsHtml;

  // Update sort arrows
  document.querySelectorAll('th[data-sort] .sort-arrow').forEach(el => el.textContent = '');
  const activeTh = document.querySelector(`th[data-sort="${state.sortKey}"] .sort-arrow`);
  if (activeTh) activeTh.textContent = state.sortDir === 'asc' ? '▲' : '▼';

  // Show/hide presence column header
  const thPresenza = document.getElementById('th-presenza');
  if (thPresenza) {
    const hasEvent = getActiveEvent() !== null;
    thPresenza.classList.toggle('hidden', !hasEvent);
  }
}

function renderStats() {
  const total = state.people.length;
  const totalDue = state.people.reduce((s, p) => s + num(p.totale), 0);
  const totalPaidAll = state.people.reduce((s, p) => s + totalPaid(p), 0);
  const totalResiduo = totalDue - totalPaidAll;
  const counts = { paid: 0, partial: 0, unpaid: 0, overpaid: 0 };
  state.people.forEach(p => counts[statusOf(p)]++);

  const hiddenAmount = '€ •••••••';
  const displayDue = state.amountsVisible ? fmtMoney(totalDue) : hiddenAmount;
  const displayPaid = state.amountsVisible ? fmtMoney(totalPaidAll) : hiddenAmount;
  const displayResiduo = state.amountsVisible ? fmtMoney(totalResiduo) : hiddenAmount;

  document.getElementById('stats').innerHTML = `
    <div class="stat">
      <div class="stat-label">Persone</div>
      <div class="stat-value">${total}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Totale dovuto</div>
      <div class="stat-value">${displayDue}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Totale incassato</div>
      <div class="stat-value" style="color: var(--green);">${displayPaid}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Residuo da incassare</div>
      <div class="stat-value" style="color: var(--red);">${displayResiduo}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Stato pagamenti</div>
      <div class="stat-value" style="font-size: 14px; line-height: 1.6;">
        <span class="badge badge-paid">${counts.paid} pagati</span>
        <span class="badge badge-partial">${counts.partial} parziali</span>
        <span class="badge badge-unpaid">${counts.unpaid} non pagati</span>
        ${counts.overpaid ? `<span class="badge badge-overpaid">${counts.overpaid} sovrap.</span>` : ''}
      </div>
    </div>
  `;
}
