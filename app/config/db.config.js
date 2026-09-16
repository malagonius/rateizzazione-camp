/* ============================================================
 * db.config.js — IndexedDB configuration
 * Replace this file to change database identifiers/version.
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
