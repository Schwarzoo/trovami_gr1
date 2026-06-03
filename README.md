# Trovami - Piattaforma per la Gestione di Animali Smarriti

Piattaforma web community-driven per la segnalazione in tempo reale di animali smarriti, matching intelligente e gestione di rifugi.

## Descrizione del Progetto

**Trovami** è un'applicazione web che facilita la ricerca e il ritrovamento di animali smarriti creando una comunità collaborativa. La piattaforma connette proprietari di animali smarriti con rifugi, soccorritori e altri utenti della community al fine di massimizzare le possibilità di ritrovamento.

### Obiettivi Principali

-  **Segnalazione in Tempo Reale**: Proprietari possono segnalare rapidamente animali smarriti con foto e dettagli
-  **Matching Intelligente**: Algoritmo smart matching che abbina automaticamente animali smarriti con avvistamenti basato su caratteristiche e posizione
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
- **AI/ML**: Hugging Face Inference (per embeddings e matching)
- **Elaborazione Immagini**: Sharp
- **Testing**: Jest + Supertest
- **Documentazione API**: Swagger/OpenAPI

### Frontend
- **HTML5** + **CSS3**
- **JavaScript Vanilla**
- **Integrazione Mappe**: Leaflet.js (API mapping)

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
- Utilizzo di embeddings IA (Hugging Face) per semantic similarity
- Ranking per vicinanza geografica e somiglianza caratteristiche
- Suggerimenti automatici agli utenti

### 4. **Sistema di Contatti**
- Richieste di contatto tra utenti
- Chat integrata per coordinamento
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

1. **Acquisizione Dati**: Il sistema raccoglie foto, descrizione, localizzazione
2. **Embedding IA**: Converte le descrizioni in vettori numerici usando modelli Hugging Face
3. **Confronto Semantico**: Confronta embedding di segnalazioni diverse
4. **Scoring Geografico**: Calcola distanza tra localizzazioni
5. **Ranking**: Combina score semantico e geografico
6. **Notifica**: Suggerisce i migliori match agli utenti interessati

---

##  API Endpoints Principali

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registrazione utente |
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/animals` | Lista animali |
| POST | `/api/v1/announcements` | Crea segnalazione |
| GET | `/api/v1/announcements` | Lista segnalazioni |
| POST | `/api/v1/contact-requests` | Contatta proprietario |
| GET | `/api/v1/notifications` | Notifiche utente |
| GET | `/api/v1/admin/audit-logs` | Log di audit (Admin) |

*Per documentazione completa, vedi `apiary.apib`*

---

##  Installazione e Setup

### Prerequisiti
- Node.js 16+
- MongoDB
- npm o yarn

### Backend Setup

```bash
cd backend

# Installa dipendenze
npm install

# Crea file .env
# Configura: DB_URL, PORT, JWT_SECRET, EMAIL credentials, HUGGINGFACE_API_KEY

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
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
HUGGINGFACE_API_KEY=your_api_key
RENDER=false  # Per mock inbox emails in dev
```



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



---

##  Team — Gruppo 1

| Nome | Matricola |
|------|-----------|
| Andrea Schwarz | 245024 |
| Matteo Zambon | 243376 |
| Alessandro Weber | 244841 |

---

##  Corso

**Ingegneria del Software** — Prof. Sandro Fiore
**A.A. 2025/2026** — Università di Trento

---
