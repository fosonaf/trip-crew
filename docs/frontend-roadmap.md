# Plan Frontend Trip Crew

Document de cadrage pour l’implémentation du front Next.js.

## 1. Cartographie des écrans

| Écran / route               | Description rapide                                                                 | Données nécessaires                                 | Actions principales                                                                      |
|-----------------------------|-------------------------------------------------------------------------------------|-----------------------------------------------------|-------------------------------------------------------------------------------------------|
| `/login`                    | Connexion via email + mot de passe, récupération du JWT.                          | Formulaire `email` / `password`.                    | Authentifier, afficher erreurs de saisie, rediriger vers dashboard.                      |
| `/register`                 | Inscription utilisateur.                                                           | Formulaire `email`, `password`, `firstName`, etc.   | Créer compte, gérer validation client, rediriger vers dashboard.                         |
| `/events`                   | Tableau de bord listant les événements auxquels l’utilisateur participe.          | Liste d’événements (rôle, statut paiement).         | Afficher filtres (à venir / passés), lien vers détail, CTA créer événement.              |
| `/events/create` (modale ?) | Formulaire de création d’événement.                                                | Champs événement + préremplissages.                 | Valider, envoyer POST, afficher feedback & rediriger.                                     |
| `/events/:eventId`          | Vue détaillée d’un événement (description, dates, membres, étapes).                | Événement, membres, étapes, rôles.                  | Accès aux sous-sections (messages, steps, check-in), actions selon rôle (organizer).      |
| `/events/:eventId/members`  | Gestion des membres (liste, rôle, statut paiement, QR code).                       | Membres + QR code utilisateur.                      | Modifier rôle/paiement, inviter, retirer membre.                                         |
| `/events/:eventId/steps`    | Ordonnancement des étapes et état des check-ins.                                   | Steps + stats check-in.                             | Créer/modifier/supprimer étape (organizer), afficher compteur check-in.                   |
| `/events/:eventId/chat`     | Messagerie temps réel (Socket.io).                                                 | Historique des messages, socket room.               | Afficher messages, envoyer, statut typing, notifier nouvelles entrées.                   |
| `/events/:eventId/checkin`  | Interface de scan QR + suivi temps réel (organizer).                               | Scan camera / input code, états check-in.           | Scanner QR, effectuer check-in manuel, voir tableau de présence.                         |
| `/profile` (optionnel)      | Affichage des informations utilisateur et possibilité de mise à jour.             | Données profil.                                     | Modifier profil, afficher token/device si besoin.                                        |

> Navigation : après login, redirection vers `/events`. Les sous-routes `:eventId` peuvent être servies via tabs ou sous-navigation.

## 2. Données persistées côté front

- Token JWT stocké en cookie HttpOnly (idéal) ou `localStorage` (en attendant mise en place SSR), gestion du refresh à prévoir.
- Cache client (React Query / Zustand) pour les listes d’événements, détails d’événement, messages, steps.
- Prévoir un store global `user` avec `id`, `firstName`, `lastName`, `email`.

## 3. Contrats d’appel REST

La table ci-dessous synthétise les endpoints consommés par le front. Les schémas `Request` / `Response` sont en TypeScript simplifié pour référence.

### Auth

| Endpoint | Méthode | Request (body) | Response (200) | Notes |
|----------|---------|----------------|----------------|-------|
| `/api/auth/register` | POST | `{ email, password, firstName, lastName, phone? }` | `{ user: User, token: string }` | Validation côté front + affichage des erreurs `400`. |
| `/api/auth/login`    | POST | `{ email, password }` | `{ user: User, token: string }` | Sauvegarder `token`, rediriger vers `/events`. |
| `/api/auth/profile`  | GET  | — | `{ user: User }` | Header `Authorization: Bearer <token>`. |

```ts
type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
};
```

### Événements

| Endpoint | Méthode | Request | Response | Commentaires |
|----------|---------|---------|----------|--------------|
| `/api/events` | GET | — | `EventWithRole[]` | Liste pour dashboard. |
| `/api/events` | POST | `CreateEventPayload` | `Event` | Organizer auto-ajouté. |
| `/api/events/:eventId` | GET | — | `EventDetail` | Inclut `members` & `steps`. |
| `/api/events/:eventId` | PUT | `UpdateEventPayload` | `{ message: string }` | Réservé organizer. |
| `/api/events/:eventId` | DELETE | — | `{ message: string }` | Confirmation front. |

```ts
type Event = {
  id: number;
  name: string;
  description?: string;
  startDate: string; // ISO
  endDate?: string;
  location?: string;
  isPaid: boolean;
  price?: number;
  createdBy: number;
};

type EventWithRole = Event & {
  role: "organizer" | "member";
  paymentStatus: "pending" | "paid" | "refunded";
};

type EventDetail = Event & {
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
  members: Array<{
    id: number;
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
    role: "organizer" | "member";
    paymentStatus: "pending" | "paid" | "refunded";
    qrCode: string;
  }>;
  steps: Step[];
};

type CreateEventPayload = {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  isPaid?: boolean;
  price?: number;
};

type UpdateEventPayload = CreateEventPayload;
```

### Membres & QR Codes

| Endpoint | Méthode | Request | Response | Notes |
|----------|---------|---------|----------|-------|
| `/api/events/:eventId/join` | POST | — | `{ message, memberId }` | Pour rejoindre un event via interface. |
| `/api/events/:eventId/qrcode` | GET | — | `{ qrCode: string }` | Base64 à intégrer dans `<img>`. |
| `/api/events/:eventId/members/:memberId/role` | PUT | `{ role }` | `{ message }` | Organizer uniquement. |
| `/api/events/:eventId/members/:memberId/payment` | PUT | `{ paymentStatus }` | `{ message }` | Organizer. |
| `/api/events/:eventId/members/:memberId` | DELETE | — | `{ message }` | Supprimer membre. |

### Steps & Check-ins

| Endpoint | Méthode | Request | Response | Commentaires |
|----------|---------|---------|----------|--------------|
| `/api/events/:eventId/steps` | GET | — | `Step[]` | Liste ordonnée. |
| `/api/events/:eventId/steps` | POST | `CreateStepPayload` | `Step` | Organizer. |
| `/api/events/:eventId/steps/:stepId` | PUT | `UpdateStepPayload` | `{ message }` | Organizer. |
| `/api/events/:eventId/steps/:stepId` | DELETE | — | `{ message }` | Organizer. |
| `/api/steps/:stepId/checkins` | GET | — | `CheckInEntry[]` | Tableau de présence. |
| `/api/steps/:stepId/status` | GET | — | `{ total, checkedIn, pending, members }` | Statistiques globales. |
| `/api/steps/:stepId/checkin` | POST | `{ memberId }` | `{ message }` | Check-in manuel. |
| `/api/steps/:stepId/scan` | POST | `{ qrData }` | `{ message, member }` | Scan QR (organizer). |

```ts
type Step = {
  id: number;
  name: string;
  description?: string;
  location?: string;
  scheduledTime: string;
  alertBeforeMinutes: number;
};

type CreateStepPayload = {
  name: string;
  description?: string;
  location?: string;
  scheduledTime: string;
  alertBeforeMinutes?: number;
};

type UpdateStepPayload = CreateStepPayload;

type CheckInEntry = {
  id: number;
  memberId: number;
  firstName: string;
  lastName: string;
  role: "organizer" | "member";
  checkedInAt: string;
};
```

### Messages

| Endpoint | Méthode | Request | Response | Notes |
|----------|---------|---------|----------|-------|
| `/api/events/:eventId/messages` | GET | `?limit?offset?` | `Message[]` | Affichage initial (reverse pour ordre croissant). |
| `/api/events/:eventId/messages` | POST | `{ content }` | `Message` | Crée un message et le push socket se chargera de la diffusion. |

```ts
type Message = {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
  };
};
```

## 4. Contrats Socket.io

| Événement | Sens | Payload | Description |
|-----------|------|---------|-------------|
| `connect` | serveur → client | — | Confirmation d’ouverture de socket. |
| `authenticate` | client → serveur | `token: string` | Associe le socket à l’utilisateur ; le serveur renvoie `authenticated` ou `error`. |
| `authenticated` | serveur → client | `{ user }` | Retour positif après authentification socket. |
| `join_event` | client → serveur | `eventId: number` | Rejoint la room `event_<id>`. Nécessite appartenance. |
| `joined_event` | serveur → client | `{ eventId }` | Ack positif. |
| `leave_event` | client → serveur | `eventId: number` | Quitte la room. |
| `send_message` | client → serveur | `{ eventId, content }` | Création message, base + émission `new_message`. |
| `new_message` | serveur → clients room | `Message` | Message nouvellement créé. |
| `typing` | client → serveur | `eventId: number` | Indique saisie en cours. |
| `user_typing` | serveur → room | `{ userId, firstName, lastName }` | Affiche indicateur. |
| `stop_typing` | client → serveur | `eventId: number` | Fin de saisie. |
| `user_stop_typing` | serveur → room | `{ userId }` | Retire indicateur. |
| `notification` | serveur → client | `{ title, message, eventId, stepId }` | Notification programmée (scheduler). |

> Gestion front : encapsuler les appels dans un hook (`useSocket`) qui s’assure d’authentifier le socket après connexion, et reconnecte proprement (sauvegarder le token).

## 5. Points d’attention

- **Gestion des rôles** : masquer/afficher les actions organiser vs membre (`isEventOrganizer` côté backend). Prévoir guard côté front et fallback si 403.
- **États de chargement** : skeleton pour liste d’événements, spinner pour actions critiques.
- **Gestion erreurs** : mapping des codes HTTP → messages utilisateur (ex. 400 validation, 401 token expiré, 403 accès interdit).
- **Responsiveness** : vérifier que les écrans principaux sont utilisables mobile/tablette (anticiper futur client mobile).
- **Accessibilité** : labels explicites, focus management sur modales, notifications ARIA pour le chat.

---

Ce document pourra évoluer au fil des sprints ; version initiale pour lancer le développement des premières pages.

