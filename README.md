# TaskBoard

## Quoi

TaskBoard, mini-Trello 3 colonnes (À faire / En cours / Terminé) en **Node.js 20 + Express + Postgres 16** pour démo BeeBoop Compute (GitHub Import + DB Time Machine). Pas de framework frontend, vanilla JS, requêtes SQL brutes via `pg`. Données réelles, scénario PITR évident..

## Local

```bash
cp .env.example .env
docker compose up --build
```

Puis ouvre [http://localhost:8080](http://localhost:8080).

Le schéma est créé au premier boot via `db/init.sql` monté dans `/docker-entrypoint-initdb.d/`. Les logs d'accès sont écrits dans `./logs/access.log` (1 ligne JSON par requête).

## Sur BeeBoop

1. Push ce repo sur ton GitHub.
2. Sur `/dashboard/compute/new` → **Importer depuis GitHub** → choisis le repo → branche `main`.
3. Port HTTP exposé : **8080**.
4. **Persister les données** ✅ (pour que `./logs`, `./uploads` et le volume Postgres soient archivés vers S3).
5. Démarrer.

Le service `db` est détecté comme Postgres → BeeBoop injecte automatiquement le sidecar `beeboop-agent` (WAL streaming + base backups) au premier boot.

## Test PITR (DB Time Machine)

1. Active **DBTM** au moment du spawn (le service `db` est détecté Postgres).
2. Crée 10 cartes via l'UI.
3. Note l'heure courante (`T0`).
4. Attends ~2 min (laisse l'agent archiver le 1er WAL segment).
5. Casse les données : soit `DELETE FROM cards;` via la SQL Console BeeBoop, soit supprime tout via l'UI.
6. Va sur `/dashboard/db-time-machine/<instance>` → **Restore PITR** à `T0`.
7. Recharge l'UI : les 10 cartes sont revenues.

## Stack

- Backend : Node.js 20 + Express, lib `pg` (pas d'ORM)
- Frontend : 1 fichier HTML + vanilla JS
- DB : `postgres:16-alpine`, schéma init via SQL
- Persistance démontrable : bind mounts `./logs` et `./uploads` (auto-snapshotés par BeeBoop), named volume `db_data` (capté par DBTM)

## Endpoints

| Méthode | Path             | Description                                      |
|---------|------------------|--------------------------------------------------|
| GET     | `/healthz`       | Ping DB                                          |
| GET     | `/api/cards`     | Cartes groupées `{todo, doing, done}`            |
| POST    | `/api/cards`     | Crée `{title, description}` en colonne `todo`    |
| PATCH   | `/api/cards/:id` | Déplace `{column_name}`                          |
| DELETE  | `/api/cards/:id` | Supprime                                         |
| GET     | `/api/stats`     | `{total, today}` pour la timeline                |
