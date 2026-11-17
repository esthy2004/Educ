# EDUFLOW — Backend API

API REST du frontend EDUFLOW. Elle reprend les modèles et les règles métier des services React (`students`, `staff`, `academics`, `finance`, `attendance`, `timetable`, `discipline`, `settings`, `dashboard`).

## Stack

- Node.js 24+ + TypeScript
- Express 4
- **PostgreSQL 16** via Docker Compose (`pg`), base principale
- Repli **SQLite** relationnel via `node:sqlite` (`data/eduflow.sqlite`) si `DATABASE_URL` n'est pas défini
- Authentification par jeton HMAC signé (`Authorization: Bearer <token>`)
- CORS et proxy Vite déjà compatibles (`/api` → `http://localhost:3000`)

## Démarrage

```bash
cd ..
npm run db:up          # PostgreSQL EDUFLOW sur le port 5433
cd back
npm install
cp .env.example .env
npm run dev            # http://localhost:3000/api
```

En production locale :

```bash
npm run build
npm start
```

PostgreSQL est initialisé automatiquement au premier lancement avec une base vierge contenant uniquement le compte administrateur. Si une base SQLite existe déjà dans `data/eduflow.sqlite`, son contenu est importé en priorité. Sinon, un ancien fichier `data/eduflow.json` est migré puis renommé en `eduflow.json.migrated`.

Sans `DATABASE_URL`, l'API utilise SQLite. Le chemin du fichier se configure avec `DB_FILE` (voir `.env.example`).

### Schéma de la base

Tables principales : `academic_years`, `terms`, `levels`, `classes`, `subjects`, `subject_levels`, `students`, `student_history`, `staff`, `staff_subjects`, `staff_classes`, `users`, `grades`, `attendance`, `fee_structures`, `invoices`, `payments`, `expenses`, `timetable`, `discipline`, `activities`, `settings`.

Les données sont chargées en mémoire au démarrage. Chaque mutation réécrit toutes les tables dans une transaction (PostgreSQL ou SQLite). En PostgreSQL, l'ordre des collections est conservé par une colonne `position`.

### Compte administrateur initial

| Identifiant | Mot de passe | Rôle |
| --- | --- | --- |
| `admin` | `admin123` | Administrateur |

La base démarre sans données métier. Modifiez le mot de passe `admin` après la première connexion.

## Authentification

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "admin123" }
```

Réponse :

```json
{
  "token": "…",
  "user": { "id": "usr_admin", "name": "…", "role": "admin" },
  "permissions": ["dashboard.view", "students.view", "…"]
}
```

`GET /api/auth/me` renvoie `{ user, permissions }` pour revalider la session et les droits courants.

Toutes les routes métier exigent ensuite l'en-tête :

```http
Authorization: Bearer <token>
```

Les permissions sont lues depuis `settings.rolePermissions` (les mêmes que `frontend/src/config/permissions.ts`). Une route non autorisée répond `403`.

Les référentiels partagés (`/api/academics/overview`, `/years`, `/terms`, `/levels`, `/classes`, `/subjects`) et l'annuaire du personnel sont lisibles par tout utilisateur authentifié ; leurs écritures restent protégées par `academics.manage` ou `staff.manage`.

## Endpoints

### Général

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/health` | État du serveur (`{ status: "ok" }`) |
| GET | `/api/dashboard` | Statistiques, séries, alertes et activités |
| GET | `/api/activities?limit=80` | Journal d'activité |
| GET | `/api/database` | Moteur, emplacement et compteurs de la base |
| GET | `/api/database/export` | Export complet JSON (`?format=text` pour du texte brut) |
| POST | `/api/database/import` | Import `{ database }` ou `{ json }` |
| POST | `/api/database/reset` | Réinitialise la base et conserve le compte administrateur |

La consultation de `/api/database` exige `settings.view`. Les routes d'export, d'import et de réinitialisation (`/api/database/*`) exigent `users.manage`.

### Authentification

`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`

### Élèves

| Méthode | Route |
| --- | --- |
| GET | `/api/students?search=&classId=&status=&gender=` |
| POST | `/api/students` |
| GET | `/api/students/:id` |
| PUT | `/api/students/:id` |
| DELETE | `/api/students/:id` (supprime aussi notes, présences, factures, paiements et discipline liés) |
| POST | `/api/students/:id/transfer` — `{ newClassId, previousClassName?, yearName? }` |
| POST | `/api/students/import` — `{ rows: [...] }` (colonnes Excel) |
| GET | `/api/students/:id/finance` — total facturé / payé / solde |

### Personnel

`GET /api/staff?search=&role=&status=`, `POST /api/staff`, `GET /api/staff/:id`, `PUT /api/staff/:id`, `DELETE /api/staff/:id`

`GET /api/staff/directory` renvoie un annuaire minimal (identité, rôle, statut, affectations) accessible à tout utilisateur authentifié, sans données salariales ni coordonnées personnelles.

### Académique

| Méthode | Route |
| --- | --- |
| GET | `/api/academics/overview` |
| GET / POST | `/api/academics/years` |
| PUT / DELETE | `/api/academics/years/:id` |
| GET / POST | `/api/academics/terms?yearId=` |
| PUT / DELETE | `/api/academics/terms/:id` |
| GET / POST | `/api/academics/levels` |
| PUT / DELETE | `/api/academics/levels/:id` |
| GET / POST | `/api/academics/classes` |
| PUT / DELETE | `/api/academics/classes/:id` |
| GET / POST | `/api/academics/subjects` |
| PUT / DELETE | `/api/academics/subjects/:id` |
| GET | `/api/academics/grades?classId=&termId=&subjectId=` |
| POST | `/api/academics/grades` — saisie groupée |
| GET | `/api/academics/rankings?classId=&termId=` |
| GET | `/api/academics/report-cards/:studentId?termId=` |

Exemple de saisie de notes :

```json
{
  "classId": "cls_6ea",
  "subjectId": "sub_math",
  "termId": "term_t1",
  "entries": [
    { "studentId": "std_0001", "type": "devoir", "score": 15.5 },
    { "studentId": "std_0002", "type": "composition", "score": null }
  ]
}
```

`score: null` supprime la note existante. Les moyennes pondérées, le rang et le bulletin sont calculés comme dans `frontend/src/utils/calculations.ts`.

### Présences

| Méthode | Route |
| --- | --- |
| GET | `/api/attendance/session?classId=&date=` |
| POST | `/api/attendance/session` — remplace l'appel de la classe à cette date |
| GET | `/api/attendance?classId=&studentId=&status=&from=&to=&search=` |
| PATCH | `/api/attendance/:id/justify` — `{ justification }` |
| DELETE | `/api/attendance/:id` |

### Finances

| Méthode | Route |
| --- | --- |
| GET / POST | `/api/fees?levelId=` |
| PUT / DELETE | `/api/fees/:id` |
| POST | `/api/fees/generate-invoices` — `{ academicYearId }` |
| GET | `/api/invoices?search=&classId=&levelId=&status=` |
| GET | `/api/invoices/open?studentId=` |
| DELETE | `/api/invoices/:id` |
| GET | `/api/payments?search=&classId=&method=&from=&to=` |
| GET | `/api/payments/:id` |
| POST | `/api/payments` — `{ studentId, invoiceId, amount, method, date, note }` |
| DELETE | `/api/payments/:id` |
| GET / POST | `/api/expenses?search=&category=&from=&to=` |
| PUT / DELETE | `/api/expenses/:id` |
| GET | `/api/finance/cash-summary` |

Les paiements refusent un montant nul, négatif ou supérieur au solde restant, et génèrent un numéro de reçu `REC-<année>-<séquence>`.

### Vie scolaire

| Méthode | Route |
| --- | --- |
| GET / POST | `/api/timetable?classId=&teacherId=` |
| DELETE | `/api/timetable/:id` |
| GET / POST | `/api/discipline?search=&studentId=&classId=&type=&status=` |
| PUT / DELETE | `/api/discipline/:id` |

La création d'un créneau vérifie les conflits d'enseignant, de salle et de classe. En cas de conflit, la réponse est `200` avec `{ "success": false, "message": "…" }`, comme le service frontend.

### Paramètres et utilisateurs

| Méthode | Route |
| --- | --- |
| GET | `/api/settings/public` | Identité de l'établissement, sans authentification (pages de connexion et documents) |
| GET / PUT | `/api/settings` |
| PUT | `/api/settings/permissions/:role` — `{ permissions: [...] }` |
| GET / POST | `/api/users` |
| PUT / DELETE | `/api/users/:id` |

Les mots de passe ne sont jamais renvoyés par les routes utilisateurs.

## Conventions de réponse

- Listes : tableau JSON brut.
- Créations : `201` avec l'objet créé (sauf opérations de comptage qui renvoient un nombre, comme `POST /api/academics/grades` et `POST /api/fees/generate-invoices`).
- Suppressions : `204` sans corps.
- Erreurs métier : `{ "message": "…" }` avec `400` (règle métier), `401`, `403`, `404` ou `409` (doublon).

## Intégration avec le frontend

Le frontend cible `/api` (`VITE_API_URL`) et son proxy Vite pointe vers `http://localhost:3000`. `GET /api/health` renvoie le format attendu par `pingServer()`.

Les services React sont branchés en **API d'abord** :

1. le jeton renvoyé par `POST /api/auth/login` est conservé dans `localStorage` ;
2. chaque requête envoie `Authorization: Bearer <token>` ;
3. les permissions de session viennent de `GET /api/auth/me` ;
4. si le serveur est injoignable, le service bascule automatiquement sur les données locales pour conserver le mode hors ligne.

Le frontend et le backend se lancent séparément : voir le `README.md` à la racine du projet.

## Limites connues

- Les mots de passe sont hachés avec **PBKDF2-SHA256** (210 000 itérations, sel aléatoire). Les anciens comptes en clair sont migrés automatiquement au démarrage et à la première connexion. Le mode hors ligne du frontend vérifie les mêmes empreintes.
- Les jetons sont signés mais ne sont pas révocables côté serveur (pas de liste de révocation). `POST /api/auth/logout` ne fait que confirmer la déconnexion côté client.
- Pas de limitation de tentatives de connexion, de journalisation HTTP ni de sauvegarde automatique planifiée.
- PostgreSQL est disponible pour un déploiement serveur, mais le backend conserve les données en mémoire et réécrit toutes les tables à chaque mutation. Ce fonctionnement ne permet pas de faire tourner plusieurs instances sur la même base sans risque d'écrasement ; pour un déploiement multi-instance, passer à des écritures SQL ciblées et à un cache partagé.
- Le fichier SQLite n'est plus mis à jour lorsque `DATABASE_URL` est défini. Conserver `data/eduflow.sqlite` comme sauvegarde de migration ou utiliser l'export JSON des Paramètres.
