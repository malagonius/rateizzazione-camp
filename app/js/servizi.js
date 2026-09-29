/* ============================================================
 * servizi.js — Servizi aggiuntivi subscriptions
 * ============================================================ */

// A subscription covers the school year: September -> June.
// Each month is represented by a normal installment record.
const SERVIZI_BILLING_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

function normalizePersonServices(person) {
  if (!person) return [];
  if (!Array.isArray(person.serviziAggiuntivi)) person.serviziAggiuntivi = [];

  person.serviziAggiuntivi.forEach(service => {
    if (!service.id) service.id = uid();
    service.nome = String(service.nome || '').trim();
    service.prezzoMensile = num(service.prezzoMensile);
    if (service.attivo === undefined) service.attivo = true;
    if (!service.schoolYearStart) service.schoolYearStart = getCurrentSchoolYearStart();
    if (!service.createdAt) service.createdAt = new Date().toISOString();
  });

  return person.serviziAggiuntivi;
}

function getCurrentSchoolYearStart(date = new Date()) {
  const month = date.getMonth() + 1;
  return month >= 9 ? date.getFullYear() : date.getFullYear() - 1;
}

function getServiceBillingDates(schoolYearStart) {
  return SERVIZI_BILLING_MONTHS.map(month => {
    const year = month >= 9 ? schoolYearStart : schoolYearStart + 1;
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });
}

function getServiceInstallmentKey(serviceId, date) {
  return `servizio_${serviceId}_${date.slice(0, 7)}`;
}

function syncPersonServiceInstallments(person) {
  if (!person) return false;
  normalizePersonServices(person);
  if (!Array.isArray(person.installments)) person.installments = [];

  let changed = false;

  person.serviziAggiuntivi.filter(s => s.attivo !== false && s.nome && s.prezzoMensile > 0).forEach(service => {
    getServiceBillingDates(service.schoolYearStart).forEach(date => {
      const key = getServiceInstallmentKey(service.id, date);
      let installment = person.installments.find(i => i.key === key);

      if (!installment) {
        installment = {
          key,
          label: `${service.nome} - ${date.slice(0, 7)}`,
          ipotesi: service.prezzoMensile,
          reale: 0,
          data: date,
          metodo: '',
          iban: '',
          serviceId: service.id,
          serviceBilling: true
        };
        person.installments.push(installment);
        changed = true;
      } else {
        // Keep payment history intact, but allow the subscription price/label
        // to be corrected before payment.
        if (num(installment.reale) === 0 && num(installment.ipotesi) !== service.prezzoMensile) {
          installment.ipotesi = service.prezzoMensile;
          changed = true;
        }
        const label = `${service.nome} - ${date.slice(0, 7)}`;
        if (installment.label !== label) {
          installment.label = label;
          changed = true;
        }
        if (installment.data !== date) {
          installment.data = date;
          changed = true;
        }
      }
    });
  });

  return changed;
}

function getServiceDue(person) {
  if (!person) return 0;
  normalizePersonServices(person);
  return (person.installments || [])
    .filter(i => i.serviceBilling)
    .reduce((sum, i) => sum + num(i.ipotesi), 0);
}

function getTotalDue(person) {
  return num(person?.totale) + getServiceDue(person);
}

function renderServicesSummary(person) {
  const container = document.getElementById('d-services-summary');
  if (!container) return;
  normalizePersonServices(person);

  const services = person.serviziAggiuntivi.filter(s => s.attivo !== false && s.nome);
  if (!services.length) {
    container.innerHTML = '<div class="empty-inline">Nessun servizio aggiuntivo sottoscritto.</div>';
    return;
  }

  container.innerHTML = services.map(service => `
    <div class="detail-service-row">
      <div>
        <strong>${escapeHtml(service.nome)}</strong>
        <div style="font-size:12px;color:var(--muted);">Settembre → Giugno · addebito il 1° del mese</div>
      </div>
      <strong>${fmtMoney(service.prezzoMensile)} / mese</strong>
    </div>
  `).join('');
}

function renderServicesTab() {
  const personSelect = document.getElementById('services-person-select');
  const list = document.getElementById('services-list');
  if (!personSelect || !list) return;

  const currentId = state.currentServicesPersonId || state.currentId || state.people[0]?.id || '';
  personSelect.innerHTML = state.people
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'))
    .map(p => `<option value="${escapeHtml(p.id)}" ${p.id === currentId ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`)
    .join('');

  const person = state.people.find(p => p.id === currentId);
  if (!person) {
    list.innerHTML = '<div class="empty">Nessuna persona.</div>';
    return;
  }

  normalizePersonServices(person);
  const services = person.serviziAggiuntivi;

  list.innerHTML = services.length ? services.map(service => `
    <div class="purchase-list-item">
      <div>
        <strong>${escapeHtml(service.nome || 'Servizio')}</strong>
        <div class="purchase-meta">${fmtMoney(service.prezzoMensile)} / mese · Settembre → Giugno · 1° del mese</div>
      </div>
      <button class="danger" data-action="remove-service" data-service-id="${escapeHtml(service.id)}">✕</button>
    </div>
  `).join('') : '<div class="empty-inline">Nessun servizio aggiuntivo.</div>';
}

async function addAdditionalService() {
  const person = state.people.find(p => p.id === state.currentServicesPersonId);
  if (!person) return;

  const name = prompt('Nome del servizio:', '');
  if (!name || !name.trim()) return;

  const amount = num(prompt('Prezzo mensile (€):', '0'));
  if (amount <= 0) {
    toast('Inserisci un prezzo mensile valido', 'error');
    return;
  }

  normalizePersonServices(person);
  person.serviziAggiuntivi.push({
    id: uid(),
    nome: name.trim(),
    prezzoMensile: amount,
    schoolYearStart: getCurrentSchoolYearStart(),
    attivo: true,
    createdAt: new Date().toISOString()
  });

  syncPersonServiceInstallments(person);
  await dbPut(person);
  renderServicesTab();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
  toast('Servizio aggiuntivo registrato', 'success');
}

async function removeAdditionalService(serviceId) {
  const person = state.people.find(p => p.id === state.currentServicesPersonId);
  if (!person) return;

  const service = (person.serviziAggiuntivi || []).find(s => s.id === serviceId);
  if (!service) return;
  if (!confirm(`Rimuovere il servizio "${service.nome}"? Le rate già create resteranno nello storico.`)) return;

  person.serviziAggiuntivi = person.serviziAggiuntivi.filter(s => s.id !== serviceId);
  // Deliberately keep service installments: they are normal payment records
  // and must not disappear from the financial history.
  await dbPut(person);
  renderServicesTab();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
}
