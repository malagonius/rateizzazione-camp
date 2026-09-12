# Rateizzazione Camp — app legacy (offline, IndexedDB)

App a pagina singola per la gestione delle rateizzazioni, degli acquisti e delle
presenze di un centro estivo. Funziona **interamente nel browser**: nessun
server, nessun account, i dati stanno in IndexedDB e i backup sono file JSON in
[app/backup/](app/backup/).

Si avvia con [AVVIA CAMP.bat](AVVIA%20CAMP.bat), che apre
[app/index.html](app/index.html).

## Questa cartella contiene solo l'app legacy

Il lavoro di migrazione verso un SaaS multi-tenant **non vive più qui**: è stato
spostato in `../asilo-saas/`. Qui dentro non ci sono più né `backend/` né
`migration-docs/`.

| | `rateizzazione-camp/` (questa) | `asilo-saas/` |
|---|---|---|
| Cos'è | App legacy offline, singolo utente | SaaS multi-tenant server-side |
| Stack | HTML + vanilla JS + IndexedDB | Express/PostgreSQL + React/Vite |
| Stato | In uso, congelata | In costruzione |
| Dati | Backup JSON in `app/backup/` | PostgreSQL |

**Regola pratica:** qui si fanno solo correzioni che servono a chi usa l'app oggi.
Ogni funzionalità nuova va in `../asilo-saas/`. Vedi `../asilo-saas/TODO.md`.

I backup JSON di questa app sono l'input di
`../asilo-saas/backend/src/migrate.js`, che li importa in PostgreSQL:

```powershell
cd ..\asilo-saas\backend
node src/migrate.js --file ..\..\rateizzazione-camp\app\backup\<file>.json --org <slug> --dry-run
```

## Struttura

```
app/
├── index.html          entrypoint dell'app
├── css/main.css
├── js/
│   ├── app.js              bootstrap e navigazione
│   ├── db.js               accesso a IndexedDB
│   ├── rateizzazione.js    elenco rateizzazioni
│   ├── rateizzazione_detail.js
│   ├── acquisti.js
│   ├── presenze.js
│   ├── backup.js           export/import JSON
│   └── utils.js
└── backup/             backup JSON esportati
```
