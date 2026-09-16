/* ============================================================
 * acquisti.config.js — Configurazione prezzi e pacchetti acquisti
 * Configurazione separata per modalità.
 * ============================================================ */

const CAMP_ACQUISTI_MODES = {
  'bunny-summer': {
    basePackages: {
      pranzo: { key: 'pranzo', label: 'Pranzo', shortLabel: 'Pranzo', rates: { one: 90, four: 340, thirteen: 1040 } },
      no_pranzo: { key: 'no_pranzo', label: 'No pranzo', shortLabel: 'No pranzo', rates: { one: 80, four: 300, thirteen: 910 } },
      ticket_10: { key: 'ticket_10', label: '10 ticket', shortLabel: '10 ticket', rates: { one: 170, four: 170, thirteen: 170 }, isTicketBundle: true, ticketTotal: 10, fixedPrice: 180 }
    },
    addonPackages: {
      none: { key: 'none', label: 'Nessun extra', shortLabel: 'Nessun extra', rates: { one: 0, four: 0, thirteen: 0 }, preLabel: '', postLabel: '' },
      pre_730: { key: 'pre_730', label: 'Pre 7:30-9:00', shortLabel: 'Pre 7:30', rates: { one: 35, four: 120, thirteen: 325 }, preLabel: 'Ingresso 7:30', postLabel: '' },
      pre_800: { key: 'pre_800', label: 'Pre 8:00-9:00', shortLabel: 'Pre 8:00', rates: { one: 30, four: 100, thirteen: 260 }, preLabel: 'Ingresso 8:00', postLabel: '' },
      post: { key: 'post', label: 'Post 17:00-18:00', shortLabel: 'Post', rates: { one: 30, four: 100, thirteen: 260 }, preLabel: '', postLabel: 'Uscita 18:00' },
      prepost_730: { key: 'prepost_730', label: 'Pre 7:30 + post', shortLabel: 'Pre 7:30 + post', rates: { one: 60, four: 200, thirteen: 520 }, preLabel: 'Ingresso 7:30', postLabel: 'Uscita 18:00' },
      prepost_800: { key: 'prepost_800', label: 'Pre 8:00 + post', shortLabel: 'Pre 8:00 + post', rates: { one: 55, four: 180, thirteen: 455 }, preLabel: 'Ingresso 8:00', postLabel: 'Uscita 18:00' }
    },
    insurance: { standard: 30, bunnyFirst: 50 },
    defaultPurchaseForm: { basePackage: 'pranzo', addonPackage: 'none', selectedWeeks: [], discountType: 'none', discountValue: 0 }
  },

  /* Placeholder: duplicato iniziale della configurazione corrente. */
  'mode-2': {
    basePackages: {
      pranzo: { key: 'pranzo', label: 'Pranzo', shortLabel: 'Pranzo', rates: { one: 90, four: 340, thirteen: 1040 } },
      no_pranzo: { key: 'no_pranzo', label: 'No pranzo', shortLabel: 'No pranzo', rates: { one: 80, four: 300, thirteen: 910 } },
      ticket_10: { key: 'ticket_10', label: '10 ticket', shortLabel: '10 ticket', rates: { one: 170, four: 170, thirteen: 170 }, isTicketBundle: true, ticketTotal: 10, fixedPrice: 180 }
    },
    addonPackages: {
      none: { key: 'none', label: 'Nessun extra', shortLabel: 'Nessun extra', rates: { one: 0, four: 0, thirteen: 0 }, preLabel: '', postLabel: '' },
      pre_730: { key: 'pre_730', label: 'Pre 7:30-9:00', shortLabel: 'Pre 7:30', rates: { one: 35, four: 120, thirteen: 325 }, preLabel: 'Ingresso 7:30', postLabel: '' },
      pre_800: { key: 'pre_800', label: 'Pre 8:00-9:00', shortLabel: 'Pre 8:00', rates: { one: 30, four: 100, thirteen: 260 }, preLabel: 'Ingresso 8:00', postLabel: '' },
      post: { key: 'post', label: 'Post 17:00-18:00', shortLabel: 'Post', rates: { one: 30, four: 100, thirteen: 260 }, preLabel: '', postLabel: 'Uscita 18:00' },
      prepost_730: { key: 'prepost_730', label: 'Pre 7:30 + post', shortLabel: 'Pre 7:30 + post', rates: { one: 60, four: 200, thirteen: 520 }, preLabel: 'Ingresso 7:30', postLabel: 'Uscita 18:00' },
      prepost_800: { key: 'prepost_800', label: 'Pre 8:00 + post', shortLabel: 'Pre 8:00 + post', rates: { one: 55, four: 180, thirteen: 455 }, preLabel: 'Ingresso 8:00', postLabel: 'Uscita 18:00' }
    },
    insurance: { standard: 30, bunnyFirst: 50 },
    defaultPurchaseForm: { basePackage: 'pranzo', addonPackage: 'none', selectedWeeks: [], discountType: 'none', discountValue: 0 }
  }
};

window.CAMP_ACQUISTI_CONFIG = CAMP_ACQUISTI_MODES[window.CAMP_ACTIVE_MODE];
