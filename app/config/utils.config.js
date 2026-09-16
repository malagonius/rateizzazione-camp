/* ============================================================
 * utils.config.js — Application constants
 * Configurazione separata per modalità.
 * ============================================================ */

const CAMP_UTILS_MODES = {
  'bunny-summer': {
    password: 'Kira',

    installments: [
      { key: 'acconto', label: 'Acconto' },
      { key: 'maggio', label: 'Rata Maggio' },
      { key: 'giugno', label: 'Rata Giugno' },
      { key: 'luglio', label: 'Rata Luglio' },
      { key: 'agosto', label: 'Rata Agosto' },
      { key: 'settembre', label: 'Rata Settembre' }
    ],

    events: [
      { id: 'bunny_camp', name: 'BUNNY CAMP', ageMin: 0, ageMax: 3, emoji: '🐰' },
      { id: 'vivi_camp', name: 'VIVI CAMP', ageMin: 4, ageMax: 13, emoji: '🌟' }
    ],

    viviCamp: {
      ageGroups: [
        { id: 'vivi_3_5', label: '3-5 anni', ageMin: 3, ageMax: 5 },
        { id: 'vivi_6_7', label: '6-7 anni', ageMin: 6, ageMax: 7 },
        { id: 'vivi_8_10', label: '8-10 anni', ageMin: 8, ageMax: 10 },
        { id: 'vivi_11_13', label: '11-13 anni', ageMin: 11, ageMax: 13 }
      ],
      maxGroupSize: 15
    },

    excelColumns: {
      acconto: { ipotesi: 'IPOTESI ACCONTO', reale: 'ACCONTO REALE', data: 'DATA ACCONTO' },
      maggio: { ipotesi: 'IPOTESI RATA MAGGIO', reale: 'RATA MAGGIO REALE', data: 'DATA MAGGIO' },
      giugno: { ipotesi: 'IPOTESI RATA GIUGNO', reale: 'RATA GIUGNO REALE', data: 'DATA GIUGNO' },
      luglio: { ipotesi: 'IPOTESI RATA LUGLIO', reale: 'RATA LUGLIO REALE', data: 'DATA LUGLIO' },
      agosto: { ipotesi: 'IPOTESI RATA AGOSTO', reale: 'RATA AGOSTO REALE', data: 'DATA AGOSTO' },
      settembre: { ipotesi: 'IPOTESI RATA SETTEMBRE', reale: 'RATA SETTEMBRE REALE', data: 'DATA SETTEMBRE' }
    },

    statusLabels: {
      paid: 'Pagato',
      partial: 'Parziale',
      unpaid: 'Non pagato',
      overpaid: 'Sovrappagato'
    }
  },

  /* Modalità 2: sostituire questi valori con la nuova configurazione. */
  'mode-2': {
    password: 'Kira',
    installments: [],
    events: [],
    viviCamp: { ageGroups: [], maxGroupSize: 15 },
    excelColumns: {},
    statusLabels: {}
  }
};

window.CAMP_UTILS_CONFIG = CAMP_UTILS_MODES[window.CAMP_ACTIVE_MODE];
