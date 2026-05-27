# Follow Rifugi Design

## Goal

Gli utenti con ruolo `user` possono seguire rifugi approvati, scegliere se ricevere notifiche solo sul sito o anche via email, vedere i rifugi seguiti nel profilo e smettere di seguirli con il bottone "Non seguire più".

## Decisions

- Il follow vive sul modello `User` come lista `followedShelters`.
- Ogni follow contiene `shelterId`, `emailEnabled` e `createdAt`.
- Il bottone sulla pagina rifugio apre un popup con due scelte: solo sito oppure sito + email.
- Smettere di seguire un rifugio rimuove la voce; da quel momento cessano notifiche sito e email.
- Quando un rifugio approvato pubblica un annuncio, i follower ricevono una notifica sito.
- I follower con `emailEnabled` ricevono anche una mail.
- Link notifica e mail puntano a `/pages/rifugio.html?rifugioId=<rifugioId>&animalId=<animalId>`, aprendo la scheda animale nella pagina del rifugio.

## Backend

- `User` aggiunge `followedShelters`.
- `Notification` aggiunge tipo `shelter_announcement`, `shelterId` e `animalId`.
- `userController` espone API per seguire, smettere di seguire e listare rifugi seguiti.
- `announcementController.createAnnouncement` notifica i follower solo per publisher `shelter` approvati.
- La mail contiene saluto, nome, eta, specie, razza e link finale.

## Frontend

- `rifugio.html/js` mostra stato follow e popup preferenze.
- `profile.html/js` aggiunge sezione "Rifugi seguiti" con "Apri pagina" e "Non seguire più".
- Le notifiche sito di tipo `shelter_announcement` mostrano un bottone verso la pagina rifugio con scheda animale aperta.

## Validation

- Verifica sintassi Node con `node --check`.
- Verifica manuale tramite API: follow, list, unfollow.
- Verifica creazione annuncio rifugio produce notifica e link corretto.
