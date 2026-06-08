/* ============================================================
 * backup.js — Daily automatic backup of all IndexedDB data
 * ============================================================
 * On each app load, checks if today's backup already exists.
 * If not, snapshots all stores (people, events, presences)
 * into a "backups" IndexedDB store AND auto-downloads a JSON
 * file named YYYY_MM_DD.json.
 * ============================================================ */

function _backupDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}`;
}

async function _backupExists(dateKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, 'readonly');
    const req = tx.objectStore(BACKUPS_STORE).get(dateKey);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => reject(req.error);
  });
}

async function _createBackupSnapshot() {
  const [people, events, presences] = await Promise.all([
    dbGetAllFrom(STORE),
    dbGetAllFrom(EVENTS_STORE),
    dbGetAllFrom(PRESENCES_STORE),
  ]);
  return { people, events, presences };
}

function _downloadJSON(dateKey, data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${dateKey}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function runDailyBackup() {
  const dateKey = _backupDateKey();
  try {
    const exists = await _backupExists(dateKey);
    if (exists) return;

    const snapshot = await _createBackupSnapshot();

    // Nothing to backup if all stores are empty
    if (!snapshot.people.length && !snapshot.events.length && !snapshot.presences.length) return;

    // Save to IndexedDB backups store
    const backupRecord = {
      id: dateKey,
      createdAt: new Date().toISOString(),
      data: snapshot,
    };
    await dbPutTo(BACKUPS_STORE, backupRecord);

    // Auto-download JSON file
    _downloadJSON(dateKey, backupRecord);

    console.log(`[Backup] Daily backup created: ${dateKey}`);
  } catch (err) {
    console.error('[Backup] Failed to create daily backup:', err);
  }
}

async function restoreBackupFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        const data = backup.data || backup;
        if (data.people) await dbBulkPutTo(STORE, data.people);
        if (data.events) await dbBulkPutTo(EVENTS_STORE, data.events);
        if (data.presences) await dbBulkPutTo(PRESENCES_STORE, data.presences);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function listBackups() {
  return dbGetAllFrom(BACKUPS_STORE);
}

async function downloadBackup(dateKey) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUPS_STORE, 'readonly');
    const req = tx.objectStore(BACKUPS_STORE).get(dateKey);
    req.onsuccess = () => {
      if (req.result) {
        _downloadJSON(dateKey, req.result);
        resolve(true);
      } else {
        resolve(false);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function getLatestBackup() {
  const all = await dbGetAllFrom(BACKUPS_STORE);
  if (!all.length) return null;
  all.sort((a, b) => b.id.localeCompare(a.id));
  return all[0];
}

async function restoreFromLatestBackup() {
  const backup = await getLatestBackup();
  if (!backup || !backup.data) return null;
  const data = backup.data;
  if (data.people && data.people.length) await dbBulkPutTo(STORE, data.people);
  if (data.events && data.events.length) await dbBulkPutTo(EVENTS_STORE, data.events);
  if (data.presences && data.presences.length) await dbBulkPutTo(PRESENCES_STORE, data.presences);
  return data;
}

function scheduleBackupRestoreCheck() {
  setTimeout(async () => {
    const hasData = state.people.length || state.events.length || state.presences.length;
    if (hasData) return;

    const latest = await getLatestBackup();
    if (!latest) return;

    const info = document.getElementById('backup-restore-info');
    info.textContent = `Backup disponibile: ${latest.id.replace(/_/g, '/')} (${latest.data.people?.length || 0} persone, ${latest.data.events?.length || 0} eventi)`;

    const modal = document.getElementById('backup-restore-modal');
    modal.classList.add('show');

    document.getElementById('backup-restore-cancel').onclick = () => modal.classList.remove('show');
    document.getElementById('backup-restore-ok').onclick = async () => {
      modal.classList.remove('show');
      try {
        const data = await restoreFromLatestBackup();
        if (data) {
          state.people = await dbGetAll();
          state.events = await dbGetAllFrom(EVENTS_STORE);
          state.presences = await dbGetAllFrom(PRESENCES_STORE);
          await ensureStaticEvents();
          await autoAssignAllPeopleToEvents();
          if (syncAllPurchasesState()) await dbBulkPut(state.people);
          applyFilters();
          toast('Dati ripristinati dal backup', 'success');
        }
      } catch (err) {
        console.error('[Backup] Restore failed:', err);
        toast('Errore ripristino: ' + err.message, 'error');
      }
    };
  }, 10000);
}
