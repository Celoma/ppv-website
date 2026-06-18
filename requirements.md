# Requirements et livrables

## Objectif
Conteneuriser une application full-stack avec:
- Backend Node.js + Express
- Frontend React
- Base PostgreSQL
- Orchestration Docker Compose

## Livrables attendus
- Dossier `backend` (API REST + connexion PostgreSQL)
- Dossier `frontend` (UI React + appels API)
- Dockerfile backend
- Dockerfile frontend
- `docker-compose.yml`
- Kanban https://supdevinci-edu-ppv.atlassian.net/jira/software/projects/SCRUM/boards/1

## Prerequis
- Docker Desktop (ou Docker Engine + Compose)
- Port 3000 libre (frontend)
- Port 4000 libre (backend)
- Port 5432 libre (PostgreSQL)

## Lancement
Depuis la racine du projet:

```bash
docker compose up --build
```

## URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api/tasks
- PostgreSQL: localhost:5432

## Arrêt
```bash
docker compose down
```

## Arrêt + suppression volume PostgreSQL
```bash
docker compose down -v
```
