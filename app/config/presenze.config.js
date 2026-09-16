/* ============================================================
 * presenze.config.js — Configurazione presenze
 * Configurazione separata per modalità.
 * ============================================================ */

const CAMP_PRESENZE_MODES = {
  'bunny-summer': {
    dayNames: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    dayCount: 6,
    extraOptions: []
  },

  /* Modalità 2: sostituire con la nuova configurazione dei giorni/opzioni. */
  'mode-2': {
    dayNames: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
    dayCount: 6,
    extraOptions: []
  }
};

window.CAMP_PRESENZE_CONFIG = CAMP_PRESENZE_MODES[window.CAMP_ACTIVE_MODE];
