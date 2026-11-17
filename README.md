# EDUFLOW — Gestion scolaire

Application complète de gestion scolaire avec un frontend React et une API REST Node.js/Express.

```
frontend/            Interface React + TypeScript + Vite (port 5173)
back/                API Express + TypeScript (port 3000)
docker-compose.yml   PostgreSQL 16 local (port 5433)
```

## Démarrage

Prérequis : Node.js 24 ou plus récent et Docker Desktop pour PostgreSQL.

```bash
npm run install:all
npm run db:up
cp back/.env.example back/.env
```

Puis, dans deux terminaux :

```bash
npm run dev:back     # API sur http://localhost:3000/api
npm run dev:front    # Interface sur http://localhost:5173
```

Ouvrez `http://localhost:5173`. Le proxy Vite transmet automatiquement `/api` au backend.

Au premier démarrage, PostgreSQL est initialisé avec le schéma relationnel. Si une base SQLite locale existe (`back/data/eduflow.sqlite`), son contenu est importé automatiquement ; sinon un ancien `back/data/eduflow.json` est migré, ou une base vierge est créée avec le seul compte administrateur.

Pour revenir au stockage SQLite sans Docker, commentez `DATABASE_URL` dans `back/.env`.

### Compte administrateur initial

| Identifiant | Mot de passe | Rôle |
| --- | --- | --- |
| `admin` | `admin123` | Administrateur |

La base de démonstration a été retirée : l'application démarre sans élève, personnel, classe, note ni facture. Modifiez le mot de passe `admin` après la première connexion.

## Base de données

Le service `db` de `docker-compose.yml` expose PostgreSQL sur le port **5433** pour ne pas entrer en conflit avec un PostgreSQL déjà installé sur le port standard.

```bash
npm run db:up        # démarre PostgreSQL
npm run db:down      # arrête le conteneur (les données sont conservées)
npm run db:logs      # suit les journaux PostgreSQL
docker compose down -v   # supprime aussi le volume de données
```

Les données sont conservées dans le volume Docker `eduflow-postgres-data`. Les identifiants de développement par défaut sont `eduflow` / `eduflow`, configurables avec `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` et `POSTGRES_PORT`.

## Fonctionnement

- L'authentification se fait auprès de l'API ; le jeton de session est conservé dans le navigateur. Les mots de passe sont hachés avec PBKDF2-SHA256 et les anciens comptes en clair sont migrés automatiquement.
- Toutes les données métier (élèves, personnel, notes, présences, finances, emploi du temps, discipline, paramètres) sont lues et écrites sur l'API.
- Les permissions par rôle sont appliquées côté serveur et côté interface.
- PostgreSQL est la base principale ; SQLite reste disponible comme repli local sans Docker. Le schéma comprend les tables `students`, `staff`, `classes`, `subjects`, `grades`, `attendance`, `invoices`, `payments`, `expenses`, `timetable`, `discipline`, `users`, `settings`, etc.
- La sauvegarde, la restauration et la réinitialisation de la base active sont disponibles dans **Paramètres → Sauvegarde des données** (réservées aux administrateurs).
- Si l'API est injoignable, l'interface bascule sur un cache local et affiche « Mode local » ou « Hors connexion ». Les modifications effectuées hors ligne restent sur l'appareil.

## Vérification et production

```bash
npm run typecheck
npm run build
npm run test:api   # API et PostgreSQL démarrés
```

Le test de fumée vérifie les principaux endpoints, les permissions et les CRUD de chaque module. Il crée ses propres données puis les supprime. Pour restaurer l'export pris au début du test, utiliser `EDUFLOW_SMOKE_RESTORE=1 npm run test:api` (bash).

Pour servir l'application compilée avec l'API :

```bash
npm run build
npm start --prefix back
npm start --prefix frontend
```

L'interface compilée est alors servie sur `http://localhost:5173` et `/api` reste proxifié vers le backend.

La documentation détaillée des routes, variables d'environnement et limites de sécurité se trouve dans `back/README.md`.
