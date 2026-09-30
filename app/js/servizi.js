/* ============================================================
 * servizi.js — Servizi aggiuntivi subscriptions
 * ============================================================ */

const SERVIZI_BILLING_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

/*
 * Catalog from the "PAGAMENTI VARI" table.
 *
 * Prices here are the monthly subscription prices. Registration and
 * insurance values are kept as metadata for future one-off billing rules;
 * the current service model only creates the monthly installments.
 *
 * Age-based prices are resolved when the subscription is created and the
 * selected option is stored on the subscription. This prevents a birthday
 * during the school year from changing already-created installments.
 */
const SERVIZI_CATALOG = [
  {
    id: 'doposcuola',
    nome: 'Doposcuola',
    options: [
      { id: 'elementari-1-5', label: 'ELEMENTARI 1-5', prezzoMensile: 100, minEta: 6, maxEta: 10 },
      { id: 'medie-1-3', label: 'MEDIE 1-3', prezzoMensile: 150, minEta: 11, maxEta: 13 }
    ]
  },
  {
    id: 'bunny-school',
    nome: 'Bunny School',
    registrationFee: 120,
    insuranceFee: 30,
    options: [
      { id: '0-24-mesi', label: '0-24 MESI', prezzoMensile: 240, minEta: 0, maxEta: 1 },
      { id: '24-36-mesi', label: '24-36 MESI', prezzoMensile: 220, minEta: 2, maxEta: 2 },
      { id: '3-6-anni', label: '3-6 ANNI', prezzoMensile: 200, minEta: 3, maxEta: 6 }
    ]
  },
  {
    id: 'pre-ingresso',
    nome: 'Pre ingresso',
    options: [
      { id: 'standard', label: '7:00-8:00', prezzoMensile: 50 }
    ]
  },
  {
    id: 'mensa',
    nome: 'Mensa',
    options: [
      { id: 'standard', label: 'Mensa', prezzoMensile: 60 }
    ]
  },
  {
    id: 'post-uscita',
    nome: 'Post uscita',
    options: [
      { id: 'standard', label: '16:00-18:00', prezzoMensile: 50 }
    ]
  },
  {
    id: 'energy-dance',
    nome: 'Energy Dance',
    insuranceFee: 15,
    options: [
      { id: 'kids', label: 'KIDS', prezzoMensile: 30 },
      { id: 'seniors', label: 'SENIORS', prezzoMensile: 30 }
    ]
  },
  {
    id: 'ludodanza',
    nome: 'Ludodanza',
    insuranceFee: 15,
    options: [
      { id: '3-6-anni', label: '3-6 ANNI', prezzoMensile: 25, minEta: 3, maxEta: 6 }
    ]
  },
  {
    id: 'teatro-in-gioco',
    nome: 'Teatro in Gioco',
    insuranceFee: 15,
    options: [
      { id: '6-13', label: '6-13', prezzoMensile: 20, minEta: 6, maxEta: 13 }
    ]
  },
  {
    id: 'moderno-coreografico',
    nome: 'Moderno Coreografico',
    insuranceFee: 15,
    options: [
      { id: '6-17', label: '6-17', prezzoMensile: 30, minEta: 6, maxEta: 17 }
    ]
  }
];

function getServiceDefinition(serviceId) {
  return SERVIZI_CATALOG.find(s => s.id === serviceId) || null;
}

function getEligibleServiceOptions(service, eta) {
  if (!service) return [];
  const age = num(eta);
  if (eta === null || eta === undefined || eta === '') {
    return service.options.filter(option => option.minEta === undefined && option.maxEta === undefined);
  }
  return service.options.filter(option => {
    if (option.minEta === undefined) return true;
    return age >= option.minEta && age <= option.maxEta;
  });
}

function getServiceOption(serviceId, optionId) {
  const service = getServiceDefinition(serviceId);
  return service?.options.find(option => option.id === optionId) || null;
}

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

  person.serviziAggiuntivi
    .filter(s => s.attivo !== false && s.nome && s.prezzoMensile > 0)
    .forEach(service => {
      getServiceBillingDates(service.schoolYearStart).forEach(date => {
        const key = getServiceInstallmentKey(service.id, date);
        let installment = person.installments.find(i => i.key === key);

        if (!installment) {
          installment = {
            key,
            label: `${service.nome} - ${service.opzioneLabel ? service.opzioneLabel + ' - ' : ''}${date.slice(0, 7)}`,
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
          if (num(installment.reale) === 0 && num(installment.ipotesi) !== service.prezzoMensile) {
            installment.ipotesi = service.prezzoMensile;
            changed = true;
          }
          const label = `${service.nome} - ${service.opzioneLabel ? service.opzioneLabel + ' - ' : ''}${date.slice(0, 7)}`;
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
        ${service.opzioneLabel ? `<div style="font-size:12px;color:var(--muted);">${escapeHtml(service.opzioneLabel)}</div>` : ''}
        <div style="font-size:12px;color:var(--muted);">Settembre → Giugno · addebito il 1° del mese</div>
      </div>
      <strong>${fmtMoney(service.prezzoMensile)} / mese</strong>
    </div>
  `).join('');
}

function renderServicesTab() {
  const personSelect = document.getElementById('services-person-select');
  const list = document.getElementById('services-list');
  const serviceSelect = document.getElementById('service-catalog-select');
  if (!personSelect || !list || !serviceSelect) return;

  const currentId = state.currentServicesPersonId || state.currentId || state.people[0]?.id || '';
  state.currentServicesPersonId = currentId;

  personSelect.innerHTML = state.people
    .slice()
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it'))
    .map(p => `<option value="${escapeHtml(p.id)}" ${p.id === currentId ? 'selected' : ''}>${escapeHtml(p.nome)}</option>`)
    .join('');

  setupSearchableSelect('services-person-select');

  const person = state.people.find(p => p.id === currentId);
  if (!person) {
    list.innerHTML = '<div class="empty">Nessuna persona.</div>';
    updateServiceCatalogOptions();
    return;
  }

  normalizePersonServices(person);

  list.innerHTML = person.serviziAggiuntivi.length ? person.serviziAggiuntivi.map(service => `
    <div class="purchase-list-item">
      <div>
        <strong>${escapeHtml(service.nome || 'Servizio')}</strong>
        ${service.opzioneLabel ? `<div class="purchase-meta">${escapeHtml(service.opzioneLabel)}</div>` : ''}
        <div class="purchase-meta">${fmtMoney(service.prezzoMensile)} / mese · Settembre → Giugno · 1° del mese</div>
      </div>
      <button class="danger" data-action="remove-service" data-service-id="${escapeHtml(service.id)}">✕</button>
    </div>
  `).join('') : '<div class="empty-inline">Nessun servizio aggiuntivo.</div>';

  updateServiceCatalogOptions();
}

function updateServiceCatalogOptions() {
  const select = document.getElementById('service-catalog-select');
  const optionSelect = document.getElementById('service-option-select');
  const info = document.getElementById('service-price-info');
  if (!select || !optionSelect || !info) return;

  const person = state.people.find(p => p.id === state.currentServicesPersonId);
  if (!select.options.length) {
    select.innerHTML = SERVIZI_CATALOG.map(service =>
      `<option value="${escapeHtml(service.id)}">${escapeHtml(service.nome)}</option>`
    ).join('');
  }

  const service = getServiceDefinition(select.value);

  optionSelect.innerHTML = '';
  if (!service || !person) {
    optionSelect.innerHTML = '<option value="">— Seleziona un servizio —</option>';
    info.textContent = '';
    return;
  }

  const options = getEligibleServiceOptions(service, person.eta);
  if (!options.length) {
    optionSelect.innerHTML = '<option value="">Nessuna opzione disponibile per l’età indicata</option>';
    info.textContent = `Età registrata: ${person.eta ?? 'non inserita'}`;
    return;
  }

  optionSelect.innerHTML = options.map(option =>
    `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)} — ${fmtMoney(option.prezzoMensile)}/mese</option>`
  ).join('');

  const ageNote = service.options.some(o => o.minEta !== undefined)
    ? ` · età: ${person.eta ?? 'non inserita'}`
    : '';

  const fees = [];
  if (service.registrationFee) fees.push(`iscrizione ${fmtMoney(service.registrationFee)}`);
  if (service.insuranceFee) fees.push(`assicurazione ${fmtMoney(service.insuranceFee)}`);

  info.textContent = fees.length
    ? `Prezzo mensile calcolato per l'opzione selezionata${ageNote}. ${fees.join(' · ')}`
    : `Prezzo mensile${ageNote}.`;
}

async function addAdditionalService() {
  const person = state.people.find(p => p.id === state.currentServicesPersonId);
  const serviceSelect = document.getElementById('service-catalog-select');
  const optionSelect = document.getElementById('service-option-select');
  if (!person || !serviceSelect || !optionSelect) return;

  const service = getServiceDefinition(serviceSelect.value);
  const option = getServiceOption(serviceSelect.value, optionSelect.value);
  if (!service || !option) {
    toast('Seleziona un servizio valido', 'error');
    return;
  }

  const eligible = getEligibleServiceOptions(service, person.eta);
  if (!eligible.some(o => o.id === option.id)) {
    toast('L’opzione non è compatibile con l’età della persona', 'error');
    return;
  }

  const alreadySubscribed = (person.serviziAggiuntivi || []).some(
    s => s.attivo !== false && s.serviceId === service.id
  );
  if (alreadySubscribed) {
    toast('Questo servizio è già sottoscritto', 'error');
    return;
  }

  normalizePersonServices(person);
  person.serviziAggiuntivi.push({
    id: uid(),
    serviceId: service.id,
    nome: service.nome,
    optionId: option.id,
    opzioneLabel: option.label,
    prezzoMensile: option.prezzoMensile,
    registrationFee: service.registrationFee || 0,
    insuranceFee: service.insuranceFee || 0,
    schoolYearStart: getCurrentSchoolYearStart(),
    attivo: true,
    createdAt: new Date().toISOString()
  });

  syncPersonServiceInstallments(person);
  await dbPut(person);
  renderServicesTab();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
  toast(`${service.nome} registrato: ${fmtMoney(option.prezzoMensile)}/mese`, 'success');
}

async function removeAdditionalService(serviceId) {
  const person = state.people.find(p => p.id === state.currentServicesPersonId);
  if (!person) return;

  const service = (person.serviziAggiuntivi || []).find(s => s.id === serviceId);
  if (!service) return;
  if (!confirm(`Rimuovere il servizio "${service.nome}"? Le rate già create resteranno nello storico.`)) return;

  person.serviziAggiuntivi = person.serviziAggiuntivi.filter(s => s.id !== serviceId);
  await dbPut(person);
  renderServicesTab();
  if (state.currentId === person.id) renderDetail();
  applyFilters();
}
