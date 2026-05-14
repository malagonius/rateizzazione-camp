/* ============================================================
 * app.js — Global event binding and initialization
 * ============================================================ */

function bindGlobalEvents() {
  // Import
  document.getElementById('btn-import').addEventListener('click', () => {
    if (state.people.length && !confirm('Importare un nuovo file sostituirà tutti i dati esistenti. Continuare?')) return;
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await importExcel(file);
    } catch (err) {
      console.error(err);
      toast('Errore importazione: ' + err.message, 'error');
    }
    e.target.value = '';
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', () => {
    if (!state.people.length) { toast('Nessun dato da esportare', 'error'); return; }
    try { exportExcel(); }
    catch (err) { console.error(err); toast('Errore esportazione: ' + err.message, 'error'); }
  });

  // Add new person
  document.getElementById('btn-add').addEventListener('click', async () => {
    const newP = {
      id: uid(),
      nome: 'Nuova persona',
      telefono: '',
      totale: 0,
      dataIscrizione: null,
      eta: null,
      installments: DEFAULT_INSTALLMENTS.map(t => ({
        key: t.key, label: t.label, ipotesi: 0, reale: 0, data: null, metodo: '', iban: ''
      })),
      assistenza: 'No',
      visibilityHidden: false
    };
    state.people.push(newP);
    await dbPut(newP);
    showDetail(newP.id);
  });

  // Reset
  document.getElementById('btn-clear').addEventListener('click', async () => {
    // Require password to confirm reset
    const password = await promptPassword('Inserisci la password per confermare il reset:');
    if (password === null) return; // user cancelled
    if (password !== PASSWORD) {
      toast('Password errata', 'error');
      return;
    }

    if (!confirm('Cancellare TUTTI i dati salvati? Operazione irreversibile.')) return;

    await dbClear();
    state.people = [];
    applyFilters();
    toast('Dati cancellati', 'success');
  });

  // Back button
  document.getElementById('btn-back').addEventListener('click', showList);

  // Toggle amounts visibility
  document.getElementById('btn-toggle-amounts').addEventListener('click', async () => {
    // If trying to show amounts, require password
    if (!state.amountsVisible) {
      const password = await promptPassword('Inserisci la password per visualizzare gli importi:');
      if (password === null) return; // user cancelled
      if (password !== PASSWORD) {
        toast('Password errata', 'error');
        return;
      }
    }

    state.amountsVisible = !state.amountsVisible;
    const btn = document.getElementById('btn-toggle-amounts');
    btn.classList.toggle('active', state.amountsVisible);
    
    // Toggle between eye-open and eye-off icons
    if (state.amountsVisible) {
      btn.innerHTML = `
        <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      btn.title = 'Nascondi importi';
    } else {
      btn.innerHTML = `
        <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      btn.title = 'Mostra importi';
    }
    
    renderStats();
    // Don't persist - always start hidden for security
    try {
      localStorage.removeItem('rateizzazione-amounts-visible');
    } catch (e) { /* ignore */ }
  });

  // Search & filter
  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    applyFilters();
  });
  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.statusFilter = e.target.value;
    applyFilters();
  });

  // Sort
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      applyFilters();
    });
  });

  // Row click → detail (but not if clicking eye button)
  document.getElementById('people-tbody').addEventListener('click', (e) => {
    // Don't navigate to detail if clicking the eye button or presence button
    if (e.target.closest('[data-action="toggle-row-visibility"]') || e.target.closest('[data-action="toggle-main-presence"]')) {
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    showDetail(tr.dataset.id);
  });

  // Toggle table-level visibility: set ALL rows to the new state
  document.getElementById('btn-toggle-table-visibility').addEventListener('click', async () => {
    // Determine target state: if any row is currently visible, hide all; otherwise show all
    const anyVisible = state.people.some(p => !p.visibilityHidden);
    const newHiddenState = anyVisible; // true = hide all, false = show all
    
    // Apply to every person and persist
    state.people.forEach(p => { p.visibilityHidden = newHiddenState; });
    await dbBulkPut(state.people);
    
    const btn = document.getElementById('btn-toggle-table-visibility');
    if (newHiddenState) {
      btn.innerHTML = `
        <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      btn.title = 'Mostra tutti gli importi';
    } else {
      btn.innerHTML = `
        <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      btn.title = 'Nascondi tutti gli importi';
    }
    
    renderList();
  });

  // Toggle row-level visibility
  document.getElementById('people-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-row-visibility"]');
    if (!btn) return;
    e.stopPropagation(); // Prevent row click
    
    const id = btn.dataset.id;
    const person = state.people.find(p => p.id === id);
    if (!person) return;
    
    person.visibilityHidden = !person.visibilityHidden;
    await dbPut(person);
    renderList();
  });

  // --- Tab navigation ---
  document.querySelectorAll('#tab-nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- Events view bindings ---
  document.getElementById('btn-new-event').addEventListener('click', showEventForm);
  document.getElementById('btn-cancel-event-form').addEventListener('click', () => {
    document.getElementById('view-event-form').classList.add('hidden');
    document.getElementById('view-events').classList.remove('hidden');
  });
  document.getElementById('btn-create-event').addEventListener('click', createEvent);

  // Event card click → detail
  document.getElementById('events-list').addEventListener('click', (e) => {
    const card = e.target.closest('[data-event-id]');
    if (card) showEventDetail(card.dataset.eventId);
  });

  // Event detail toolbar
  document.getElementById('btn-back-events').addEventListener('click', () => {
    document.getElementById('view-event-detail').classList.add('hidden');
    document.getElementById('view-events').classList.remove('hidden');
    state.currentEventId = null;
    renderEventsList();
  });
  document.getElementById('btn-add-person-to-group').addEventListener('click', showAddToGroupModal);
  document.getElementById('btn-delete-event').addEventListener('click', async () => {
    const event = getCurrentEvent();
    if (!event) return;
    if (!confirm(`Eliminare l'evento "${event.name}"?`)) return;
    await dbDeleteFrom(EVENTS_STORE, event.id);
    state.events = state.events.filter(e => e.id !== event.id);
    // Remove related presences
    const toRemove = state.presences.filter(pr => pr.eventId === event.id);
    for (const pr of toRemove) await dbDeleteFrom(PRESENCES_STORE, pr.id);
    state.presences = state.presences.filter(pr => pr.eventId !== event.id);
    state.currentEventId = null;
    document.getElementById('view-event-detail').classList.add('hidden');
    document.getElementById('view-events').classList.remove('hidden');
    renderEventsList();
    toast('Evento eliminato', 'success');
  });

  // Event sub-view tabs (groups / presences)
  document.querySelectorAll('.event-sub-tabs button[data-subview]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.eventSubView = btn.dataset.subview;
      document.querySelectorAll('.event-sub-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEventSubView();
    });
  });

  // Add to group modal
  document.getElementById('atg-ok').addEventListener('click', confirmAddToGroup);
  document.getElementById('atg-cancel').addEventListener('click', hideAddToGroupModal);
  document.getElementById('add-to-group-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('add-to-group-modal')) hideAddToGroupModal();
  });

  // Presences overview back button
  document.getElementById('btn-back-from-overview').addEventListener('click', () => {
    document.getElementById('view-presences-overview').classList.add('hidden');
    if (state.currentEventId) {
      document.getElementById('view-event-detail').classList.remove('hidden');
    } else {
      document.getElementById('view-events').classList.remove('hidden');
    }
  });

  // Week detail modal close
  document.getElementById('week-detail-modal-close').addEventListener('click', hideWeekDetailModal);
  document.getElementById('week-detail-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('week-detail-modal')) hideWeekDetailModal();
  });

  // Main table presence button
  document.getElementById('people-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="toggle-main-presence"]');
    if (!btn) return;
    e.stopPropagation();
    const { personId, eventId, week } = btn.dataset;
    await togglePresence(eventId, parseInt(week), personId);
    const present = isPresent(eventId, parseInt(week), personId);
    btn.className = 'btn-present ' + (present ? 'marked' : '');
    btn.innerHTML = present ? '✅ Presente' : '📋 Segna';
  });
}

// ============================================================
// Init
// ============================================================
async function init() {
  bindGlobalEvents();
  bindDetailEvents();
  try {
    state.people = await dbGetAll();
    // Normalize legacy assistenza values to 'Si'/'No' and ensure visibilityHidden/eta exists
    state.people.forEach(p => {
      p.assistenza = normalizeAssistenza(p.assistenza);
      if (p.visibilityHidden === undefined) p.visibilityHidden = false;
      if (p.eta === undefined) p.eta = null;
    });
    // Load events and presences
    state.events = await dbGetAllFrom(EVENTS_STORE);
    state.presences = await dbGetAllFrom(PRESENCES_STORE);
  } catch (err) {
    console.error('DB load error', err);
    toast('Errore caricamento dati: ' + err.message, 'error');
  }
  // Always start with amounts hidden (security requirement)
  // Set the eye-off icon to match the hidden state
  try {
    const btn = document.getElementById('btn-toggle-amounts');
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    btn.title = 'Mostra importi';
    // Clear any saved preference
    localStorage.removeItem('rateizzazione-amounts-visible');
  } catch (e) { /* ignore */ }
  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
