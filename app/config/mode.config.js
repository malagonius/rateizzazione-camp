/* ============================================================
 * mode.config.js — Modalità applicazione
 *
 * Cambiare activeMode per selezionare l'intera configurazione
 * dell'applicazione senza modificare i file JavaScript.
 * ============================================================ */

window.CAMP_MODE_CONFIG = {
  activeMode: 'bunny-summer',

  modes: {
    'bunny-summer': {
      label: 'Bunny Summer'
    },
    'mode-2': {
      label: 'Modalità 2'
    }
  }
};

window.CAMP_ACTIVE_MODE = window.CAMP_MODE_CONFIG.activeMode;

if (!window.CAMP_MODE_CONFIG.modes[window.CAMP_ACTIVE_MODE]) {
  throw new Error(`Modalità non configurata: ${window.CAMP_ACTIVE_MODE}`);
}
