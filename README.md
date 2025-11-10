# Trip Crew

Plateforme de gestion de voyages en groupe construite sur un backend Node.js/TypeScript. L'API expose des fonctionnalités d'organisation d'événements, d'invitations via QR codes, de suivi des participants et d'échanges en temps réel grâce à Socket.io.

## Fonctionnalités clés

- Authentification par JWT et gestion du profil utilisateur.
- Création et gestion complète des événements (CRUD).
- Invitation et gestion des membres d'événement (rôles, statut de paiement, QR codes).
- Planification d'étapes avec alertes programmées et statistiques de présence.
- Check-in manuel ou par scan de QR code.
- Messagerie temps réel par Socket.io (canaux par événement) et indicateurs de saisie.
- Notifications programmées (cron) pour prévenir les membres des étapes imminentes.

## Stack technique

- **Serveur** : Express.js + TypeScript.
- **Base de données** : PostgreSQL (via `pg`).
- **Temps réel** : Socket.io (WebSocket + fallback).
- **Authentification** : JSON Web Tokens (`jsonwebtoken`).
- **Planification** : `node-cron` pour les notifications.
- **Validation** : `express-validator`.

La structure principale du backend se trouve dans `backend/src/` (`controllers`, `routes`, `services`, `sockets`, etc.).

## Prérequis

- Node.js ≥ 18
- npm ≥ 9
- PostgreSQL ≥ 13

## Installation rapide

```bash
git clone <repo-url>
cd trip-crew
npm install --prefix backend
npm install --prefix frontend
```

## Configuration de l'environnement

Dans le dossier `backend/`, créer un fichier `.env` à partir de cet exemple :

```env
PORT=5000
NODE_ENV=development

CLIENT_URL=http://localhost:3000
CLIENT_URLS=http://localhost:3000,http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=trip_crew
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=remplacez-moi
JWT_EXPIRES_IN=7d
```

> `CLIENT_URLS` accepte une liste séparée par des virgules. Ajoutez-y les origines autorisées (web, mobile, tests).

## Démarrage du serveur

| Mode        | Commande             | Description                                    |
|-------------|---------------------|------------------------------------------------|
| Développement | `npm run dev`        | Démarre le serveur Express avec `ts-node-dev`. |
| Production  | `npm run build`      | Compile TypeScript vers `dist/`.               |
|             | `npm start`          | Lance `dist/server.js` via Node.js.            |

L'API est exposée sur `http://localhost:<PORT>` et le WebSocket sur le même port (`ws://localhost:<PORT>`).

### Vérifier l'authentification (endpoint `/api/auth/login`)

1. Si aucun utilisateur n'existe encore, créez-en un via l'endpoint d'inscription :
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com","password":"Passw0rd!","firstName":"Alice","lastName":"Martin","phone":"+33600000000"}'
   ```
2. Testez ensuite la connexion pour vérifier que le JWT est bien émis :
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"alice@example.com","password":"Passw0rd!"}'
   ```
3. La réponse doit contenir un objet `user` et un champ `token`. Gardez ce token pour les tests suivants (ex : WebSocket, routes protégées).

### Vérifier Socket.io

1. Installez les dépendances du dossier `scripts/` (une seule fois) :
   ```bash
   cd ../scripts
   npm install
   npm install socket.io-client
   ```
2. Mettez à jour `scripts/test-socketio.js` avec votre token JWT (obtenu au login) et un `eventId` auquel l'utilisateur connecté appartient.
3. Lancez le script :
   ```bash
   node test-socketio.js
   ```
4. Une fois connecté, le script rejoint la room de l'événement et vous permet d'envoyer des messages depuis le terminal. Vérifiez que les événements `new_message` ou les erreurs éventuelles s'affichent comme attendu.

## Démarrer le front

1. Dans un premier terminal, lancez le backend (`cd backend && npm run dev`) afin de servir l'API.
2. Dans un second terminal :
   ```bash
   cd frontend
   npm run dev
   ```
3. Ouvrez `http://localhost:3000` pour accéder à l’interface web Trip Crew.

## Ressources complémentaires

- Collection Postman : `docs/postman/TripCrew.postman_collection.json`

