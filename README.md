# Mes Taches

Application de gestion de taches : frontend React (Vite), API Express, base MongoDB.

| Environnement | URL | Branche |
| ------------- | --- | ------- |
| Production | https://exam-taskapp.vercel.app | `main` |
| Pre-production | https://exam-taskapp-preprod.vercel.app | `develop` |
| Docker local | http://localhost:8080 | toutes |

## Architecture

```
Navigateur --HTTPS--> Vercel (CDN, region Paris cdg1)
                       |-- /*      -> service frontend (fichiers statiques Vite)
                       '-- /api/*  -> service backend (fonction Express, Node 26)
                                        '--> MongoDB Atlas (Paris) : base taskapp_prod / taskapp_preprod
```

Un seul domaine par environnement : pas de CORS, cookie de session `SameSite=Strict`.

## Lancer en local

Avec Docker (recommande) :

```bash
cp .env.docker.example .env.docker   # puis renseigner JWT_SECRET
docker compose up --build -d          # http://localhost:8080
bash scripts/smoke-test.sh http://localhost:8080
```

Sans Docker (MongoDB local requis) :

```bash
cd backend && cp .env.example .env && npm ci && npm run dev    # API sur :5000
cd frontend && npm ci && npm run dev                           # http://localhost:3000 (proxy /api)
```

## Qualite

| Commande | backend | frontend |
| -------- | ------- | -------- |
| Lint | `npm run lint` | `npm run lint` |
| Tests | `npm test` | `npm test` |
| Couverture | `npm run test:cov` | `npm run test:cov` |
| Documentation | `npm run docs` (JSDoc -> `docs/api/`) | |

Specification de l'API : [`docs/openapi.yaml`](docs/openapi.yaml). Journal des evolutions : [`CHANGELOG.md`](CHANGELOG.md).

## CI/CD

- `ci.yml` (chaque push et PR) : lint, tests avec seuil de couverture, `npm audit`, build, images Docker (GHCR).
- Deploiement continu par l'integration Git de Vercel : push sur `develop` -> projet `exam-taskapp-preprod`,
  push sur `main` -> projet `exam-taskapp`. Chaque projet ignore les autres branches.
- `deploy.yml` : attend que l'URL publique serve le commit pousse (`/api/health`), puis test de fumee de bout en bout.
- `uptime.yml` : sonde des deux environnements toutes les 15 minutes, alerte par e-mail en cas d'echec.
- `backup.yml` : sauvegarde quotidienne chiffree de la base de production.
- `audit.yml` : rapport d'audit quotidien des deux environnements et `npm audit`, alerte si un seuil est depasse.

## Supervision (Prometheus + Grafana)

La pile Docker inclut Prometheus et Grafana, configures au demarrage (aucun reglage manuel) :

| Outil | URL | Contenu |
| ----- | --- | ------- |
| Grafana | http://localhost:3001 (admin / `GF_SECURITY_ADMIN_PASSWORD`) | Tableau de bord "Mes Taches - supervision" |
| Prometheus | http://localhost:9090/alerts | 8 regles d'alerte et leur etat |

- L'API expose `/metrics` (format Prometheus) seulement si `METRICS_ENABLED=true`, et seulement sur le reseau
  Docker interne (ni nginx ni Vercel ne publient cette route). Jeton Bearer optionnel : `METRICS_TOKEN`.
- Metriques : requetes par route et code, latence (p50/p95/p99), evenements de securite, etat MongoDB, memoire.
- Alertes (`monitoring/prometheus/alerts.yml`) : API ou base indisponible, plus de 5 % d'erreurs 5xx,
  latence p95 > 500 ms, memoire > 300 Mo, force brute, IP bloquee, jetons falsifies.
- Verification : `bash scripts/check-monitoring.sh`.

## Audit

Les evenements de securite sont enregistres dans la collection `auditlogs` (90 jours) et dans les logs.
Rapport a la demande : `cd backend && MONGO_URI=... npm run audit:report -- --days=7`.

## Configuration

Variables (Vercel > Settings > Environment Variables, ou `.env`) : voir [`backend/.env.example`](backend/.env.example).
L'API refuse de demarrer si `MONGO_URI` manque ou si `JWT_SECRET` fait moins de 32 caracteres.
