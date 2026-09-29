/* ============================================================
 * db.config.js — IndexedDB configuration
 * Il database è condiviso tra tutte le modalità: i bambini e i
 * relativi dati sono gli stessi indipendentemente dalla modalità.
 * ============================================================ */

window.CAMP_DB_CONFIG = {
  name: 'rateizzazione-camp',
  version: 3,
  stores: {
    people: 'people',
    events: 'events',
    presences: 'presences',
    backups: 'backups'
  }
};
