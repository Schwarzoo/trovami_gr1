# Trovami - Piattaforma per la Gestione di Animali Smarriti

Piattaforma web community-driven per la segnalazione in tempo reale di animali smarriti, matching intelligente e gestione di rifugi.

## Descrizione del Progetto

**Trovami** è un'applicazione web che facilita la ricerca e il ritrovamento di animali smarriti creando una comunità collaborativa. La piattaforma connette proprietari di animali smarriti con rifugi ed altri utenti della community al fine di massimizzare le possibilità di ritrovamento.

### Obiettivi Principali

-  **Segnalazione in Tempo Reale**: Proprietari possono segnalare rapidamente animali smarriti con foto e dettagli
-  **Matching Intelligente**: Algoritmo smart matching che abbina automaticamente animali smarriti con avvistamenti basato su caratteristiche
-  **Localizzazione Geografica**: Sistema di geolocalizzazione per trovare rifugi e avvistamenti vicini
-  **Gestione Rifugi**: Interfaccia dedicata per rifugi e veterinari per segnalare animali trovati
-  **Community Collaboration**: Gli utenti possono segnalare avvistamenti e ricevere notifiche real-time
-  **Sistema di Notifiche**: Notifiche email automatiche per aggiornamenti rilevanti
-  **Autenticazione Sicura**: Sistema di registrazione, login e gestione profili con JWT

---

##  Tecnologie Utilizzate

### Backend
- **Runtime**: Node.js + Express.js (v5.2.1)
- **Database**: MongoDB + Mongoose
- **Autenticazione**: JWT + bcryptjs
- **Email**: Nodemailer
- **AI/ML**: Sentence Transformers con modello preaddestrato CLIP `clip-ViT-B-32` (per embeddings immagine e matching)
- **Elaborazione Immagini**: Sharp
- **Testing**: Jest + Supertest
- **Documentazione API**: Apiary (`apiary.apib`)

### Frontend
- **HTML5** + **CSS3**
- **JavaScript Vanilla**
- **Integrazione Mappe**: Leaflet.js (API mapping)

---

##  Scelte Tecnologiche Frontend

Il frontend del progetto è stato sviluppato volutamente con **HTML, CSS e JavaScript puro**, senza framework come React, Vue o Angular. Questa scelta permette di mantenere il progetto leggero, facilmente eseguibile e comprensibile in ogni sua parte, evitando dipendenze aggiuntive non necessarie per gli obiettivi del corso.

L'utilizzo di tecnologie native del browser consente inoltre di mostrare in modo diretto la struttura dell'applicazione, la gestione degli eventi, le chiamate alle API REST e la manipolazione del DOM. In questo modo il codice rimane trasparente e valutabile, senza che la logica principale venga nascosta dietro astrazioni di framework.

Questa impostazione è coerente con la natura universitaria del progetto: l'obiettivo non è dimostrare l'uso di una libreria specifica, ma progettare e realizzare un sistema completo, mantenibile e funzionante, con una separazione chiara tra frontend, backend, API, persistenza dei dati, autenticazione e test.

---

##  Struttura del Progetto

```
trovami_gr1/
├── backend/                      # API REST e logica server
│   ├── controllers/              # Controller per ogni endpoint
│   ├── models/                   # Schemi MongoDB (User, Animal, Announcement, ecc.)
│   ├── routes/                   # Definizione delle route API
│   ├── middleware/               # Middleware di autenticazione
│   ├── services/                 # Logica di business
│   │   ├── SmartMatchingEngine   # Motore di matching intelligente
│   │   ├── emailService.js       # Servizi email
│   │   └── auditService.js       # Log di audit
│   ├── tests/                    # Test unitari e di integrazione
│   ├── scripts/                  # Script di utilità (embedding)
│   ├── server.js                 # Entry point server
│   └── package.json
│
├── frontend/                     # Interfaccia web
│   ├── pages/                    # Pagine HTML
│   ├── js/                       # Logica JavaScript client-side
│   ├── css/                      # Stili
│   ├── partials/                 # Header/Footer riutilizzabili
│   └── index.html                # Homepage
│
├── apiary.apib                   # Documentazione API
└── README.md
```

---

##  Modelli Dati Principali

### User (Utente)
- Profilo personale con foto
- Ruolo: User, Shelter, Admin
- Contatti e informazioni di verifica email

### Animal (Animale)
- Specie, razza, colore
- Foto e descrizione
- Data di smarrimento
- Localizzazione

### Announcement (Segnalazione)
- Segnalazione di animale smarritto o trovato
- Foto multiple
- Descrizione dettagliata
- Status (open, closed, resolved)

### ContactRequest (Richiesta di Contatto)
- Connessione tra chi ha segnalato e chi ha avvistato

### Notification (Notifica)
- Notifiche in-app e via email
- Relative a matching, messaggi, aggiornamenti

---

##  Funzionalità Principali

### 1. **Autenticazione e Profili**
- Registrazione con email verification
- Login sicuro con JWT
- Recupero password
- Gestione profilo personale

### 2. **Segnalazione Animali**
- Creazione rapida di segnalazioni (smarrito/trovato)
- Upload multi-foto
- Descrizione dettagliata con caratteristiche
- Geolocalizzazione automatica

### 3. **Smart Matching Engine**
- Confronto automatico tra segnalazioni di smarrimento e avvistamenti
- Utilizzo di embeddings immagine generati localmente con il modello preaddestrato CLIP `clip-ViT-B-32`
- Ranking somiglianza caratteristiche
- Suggerimenti automatici agli utenti

### 4. **Sistema di Contatti**
- Richieste di adozione tra rifugio-user
- Chat integrata per coordinamento sull'annuncio
- Tracking dello status (pending, accepted, resolved)

### 5. **Gestione Rifugi**
- Dashboard admin per gestione rifugi
- Lista animali in custodia
- Segnalazioni prioritarie
- Reporting e statistics

### 6. **Notifiche Real-Time**
- Email automatiche per matching significativi
- Notifiche in-app per nuovi messaggi
- Digest periodici per segnalazioni vicine

### 7. **Audit e Sicurezza**
- Log completo di tutte le azioni
- Gestione ruoli (User, Shelter, Admin)
- Middleware di autenticazione per endpoint protetti

---

##  Come Funziona il Matching Intelligente

1. **Acquisizione Dati**: Il sistema raccoglie foto
2. **Embedding IA**: Converte le foto in vettori numerici usando Sentence Transformers e il modello preaddestrato CLIP `clip-ViT-B-32`
3. **Confronto Semantico**: Confronta embedding di segnalazioni diverse
4. **Ranking**: Combina score semantico e geografico
5. **Notifica**: Suggerisce i migliori match agli utenti interessati

In ambiente locale il backend invoca lo script Python `backend/scripts/generate_embedding.py`, che carica il modello preaddestrato `clip-ViT-B-32` tramite `sentence-transformers`. In ambiente Render (`RENDER=true`) viene usato un vettore simulato a 512 dimensioni per evitare problemi di memoria.

---

##  API Endpoints Principali

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/v1/auth/users` | Registrazione utente |
| POST | `/api/v1/auth/sessions` | Login |
| DELETE | `/api/v1/auth/sessions/current` | Logout |
| POST | `/api/v1/auth/password-reset-requests` | Richiesta recupero password |
| PATCH | `/api/v1/auth/password` | Reset password |
| GET | `/api/v1/animals` | Lista animali |
| POST | `/api/v1/announcements` | Crea segnalazione |
| GET | `/api/v1/announcements` | Lista segnalazioni |
| GET | `/api/v1/announcements/count` | Conteggio segnalazioni per stato |
| POST | `/api/v1/contact-requests` | Contatta proprietario |
| GET | `/api/v1/notifications` | Notifiche utente |
| GET | `/api/v1/admin/audit-logs` | Log di audit (Admin) |
| GET | `/api/v1/admin/rifugi` | Richieste rifugi (Admin) |

*Per documentazione completa, vedi `apiary.apib`*

---

##  Installazione e Setup

### Prerequisiti
- Node.js 18+
- MongoDB
- npm o yarn

### Backend Setup

```bash
cd backend

# Installa dipendenze
npm install

# Crea file .env
# Configura: DB_URL, PORT, JWT_SECRET, SMTP credentials, URL applicativi

#CONFIGURA VENV(solo da local host per i smart matching tra annunci)
python -m venv venv
venv\Scripts\activate
pip install -r scripts/requirements.txt
exit

# Avvia server
npm start

# Test
npm test
```

---

I test coprono:
- Autenticazione e JWT
- CRUD operazioni
- Smart Matching
- Email Service
- Admin operations
- Notifiche

---


### Variabili d'Ambiente (.env)

```env
DB_URL=mongodb+srv://...
PORT=3000
JWT_SECRET=your_secret_key
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
PYTHON_PATH=python
RENDER=false  # true abilita mock e simulazioni compatibili con Render
```

### Deploy su Render

Il progetto Node si trova nella cartella `backend`, mentre il frontend viene servito dal server Express con i file presenti in `frontend`. Per evitare errori di avvio su Render, configurare il servizio web in uno di questi due modi:

```txt
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

In alternativa, se il servizio viene lasciato sulla root del repository:

```txt
Build Command: cd backend && npm install
Start Command: cd backend && npm start
```

Variabili da impostare su Render:

```env
DB_URL=mongodb+srv://...
JWT_SECRET=your_secret_key
BACKEND_URL=https://trovami-app.onrender.com
FRONTEND_URL=https://trovami-app.onrender.com
RENDER=true
```

`PORT` non deve essere forzata: Render la assegna automaticamente e il server usa `process.env.PORT`.



##  Flusso Utente Tipico

1. **Registrazione**: Utente si registra e verifica email
2. **Segnalazione**: Proprietario segnala animale smarrito
3. **Community Reports**: Altri utenti vedono la segnalazione e riportano avvistamenti
4. **Smart Matching**: Sistema suggerisce abbinamenti automatici
5. **Contatto**: Utenti si contattano tramite piattaforma
6. **Closure**: Segnalazione chiusa quando animale è trovato
7. **Audit**: Admin può visualizzare la cronologia completa

---

##  Sicurezza

-  Password hashate con bcryptjs
-  JWT per session management
-  CORS configurato
-  Email verification obbligatoria
-  Middleware di autenticazione su route sensibili
-  Audit logging di tutte le azioni critiche
-  Validazione input su tutti gli endpoint

---

##  Stato Sviluppo

Questo è un progetto attualmente universitario in sviluppo attivo per il corso di **Ingegneria del Software** presso l'Università di Trento.
Essendo appunto in stato di sviluppo alcune funzionalità non sono disponibili ma sostiuite in modo da rendere tutto funzionale e coerente col progetto.(ad esempio email e smart matching sono pronti ma non resi disponibili da render)


---

##  Team — Gruppo 1

| Nome | Matricola |
|------|-----------|
| Andrea Schwarz | 245024 |
| Matteo Zambon | 243376 |
| Alessandro Weber | 244841 |

---

##  Nota sulle Statistiche dei Contributi

Le statistiche mostrate da GitHub nella sezione contributi possono risultare falsate, perché includono anche file generati, file di lock, documentazione API o modifiche automatiche che non rappresentano direttamente righe di codice scritte a mano.

Per ottenere un conteggio più corretto delle righe di codice prodotte da ciascun componente del gruppo, eseguire i seguenti comandi dal terminale Git posizionato nella cartella principale del progetto:

### Matteo Zambon

```bash
git log --author="zambonmatteo" --pretty=tformat: --numstat | grep -vE 'package-lock\.json|package\.json|node_modules/|apiary\.apib' | awk '{ add += $1; subs += $2 } END { printf "Righe aggiunte: %s\nRighe rimosse: %s\nTotale netto: %s\n", add, subs, add - subs }'
```

Risultato:

```text
Totale netto: 8632
```

### Andrea Schwarz

```bash
git log --author="Andrea Schwarz" --pretty=tformat: --numstat | grep -vE 'package-lock\.json|package\.json|node_modules/|apiary\.apib' | awk '{ add += $1; subs += $2 } END { printf "Righe aggiunte: %s\nRighe rimosse: %s\nTotale netto: %s\n", add, subs, add - subs }'
```

Risultato:

```text
Totale netto: 10361
```

### Alessandro Weber

```bash
git log --author="aleweb04" --pretty=tformat: --numstat | grep -vE 'package-lock\.json|package\.json|node_modules/|apiary\.apib' | awk '{ add += $1; subs += $2 } END { printf "Righe aggiunte: %s\nRighe rimosse: %s\nTotale netto: %s\n", add, subs, add - subs }'
```

Risultato:

```text
Totale netto: 5323
```

Questi comandi escludono dal calcolo i file `package-lock.json`, `package.json`, `node_modules/` e `apiary.apib`, così da evitare che le statistiche vengano alterate da dipendenze, file generati o documentazione non rappresentativa del contributo diretto sul codice.

---

##  Corso

**Ingegneria del Software** — Prof. Sandro Fiore
**A.A. 2026** — Università di Trento

---
