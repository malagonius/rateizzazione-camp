/* ============================================================
 * db.config.js — IndexedDB configuration
 * Configurazione separata per modalità.
 * ============================================================ */

const CAMP_DB_MODES = {
  'bunny-summer': {
    name: 'rateizzazione-camp',
    version: 3,
    stores: {
      people: 'people',
      events: 'events',
      presences: 'presences',
      backups: 'backups'
    }
  },

  /* Modalità 2: impostare qui nome/versione/store del nuovo archivio se necessario. */
  'mode-2': {
    name: 'rateizzazione-camp-mode-2',
    version: 1,
    stores: {
      people: 'people',
      events: 'events',
      presences: 'presences',
      backups: 'backups'
    }
  }
};

window.CAMP_DB_CONFIG = CAMP_DB_MODES[window.CAMP_ACTIVE_MODE];
