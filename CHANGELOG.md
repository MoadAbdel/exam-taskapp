# Journal des evolutions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).
Les versions sont listees de la plus recente a la plus ancienne. Chaque version liste ses commits (du plus recent au plus ancien) et porte un tag Git `vX.Y.Z`.

## [2.5.0] - 2026-11-27

### Mise en conformite

- Interface formatee avec Prettier, controle ajoute a la CI.
- Test de restauration automatique (`restore-test.yml`) : derniere sauvegarde rechargee dans une base jetable.
- Environnement conteneurise en ligne sur Vercel (image construite depuis `backend/Dockerfile`).
- Branche `main` protegee : pull request et CI verte obligatoires.
- Versions alignees (API, interface, OpenAPI) et tags Git par version.

## [2.4.0] - 2026-11-27

Commits : 63432af, f8782f4, 15d1b27, 9e528b4, 04cf060, a0bb700.

### Conformite RGPD

- Page "Confidentialite" : donnees, finalites, bases legales, durees, sous-traitants, cookie, droits, CNIL.
- Page "Mon compte" : export JSON des donnees (acces, portabilite) et suppression du compte avec mot de passe
  (effacement) ; la piste d'audit est anonymisee.
- Minimisation : IP tronquees et noms d'utilisateur retires avant envoi a Grafana ; IP tronquees et noms masques
  dans le rapport d'audit (publie dans les journaux CI d'un depot public), messages d'erreur retires du rapport.
- Cookie de session strictement necessaire : pas de bandeau de consentement. Aucun e-mail collecte : pas d'opt-in.
- Sauvegardes chiffrees deplacees des artefacts GitHub (depot public) vers un stockage Vercel Blob prive.

## [2.3.0] - 2026-11-27

Commits : a47931d, 7410dd3.

### Ajouts (E25 et E26)

- Envoi des logs et evenements d'audit de la pre-production et de la production vers Grafana Cloud (Loki),
  par lots, apres la reponse (`waitUntil`) : aucune attente pour l'utilisateur. Une panne de Loki ne bloque rien.
- Journal d'acces : ajout du modele de route (`route`).
- 4 tests du transport Loki.
- Grafana Cloud : sondes Paris et Francfort, un tableau de bord par environnement, 6 alertes
  (`monitoring/grafana-cloud/setup.mjs`).

## [2.2.0] - 2026-11-27

Commits : fbb65a7.

### Ajouts (E26 : supervision)

- Metriques Prometheus dans l'API (`prom-client`) : `http_requests_total`, `http_request_duration_seconds`,
  `security_events_total`, `mongodb_up`, metriques Node.js. Routes etiquetees par modele (pas d'ID brut).
  Endpoint `/metrics` desactive par defaut, interne, jeton optionnel.
- Pile Docker : Prometheus (collecte toutes les 15 s, 8 regles d'alerte) et Grafana (source de donnees
  et tableau de bord provisionnes). Ports lies a 127.0.0.1 uniquement.
- `scripts/check-monitoring.sh` : verifie cibles, regles, alertes actives et metriques cles.

### Corrections

- Alerte de latence : connexion et inscription exclues (lentes volontairement a cause de bcrypt).
- Tableau de bord : taux d'erreurs 5xx a 0 % au lieu de "No data" sans erreur ; collectes de Prometheus
  exclues du trafic mesure.

## [2.1.0] - 2026-11-27

Commits : 168e611, 84eac1b.

### Ajouts (E25 : outils d'audit)

- Piste d'audit persistante : collection MongoDB `auditlogs`, conservee 90 jours (index TTL), une par environnement.
  Evenements : inscription, connexion, connexion_echec, deconnexion, tache_supprimee, jeton_invalide
  (jeton falsifie), limite_atteinte (force brute bloquee), erreur_serveur (avec requestId). Jamais de mot de passe.
  Avant : evenements seulement dans les logs de la plateforme, gardes peu de temps et non interrogeables.
- Outil `npm run audit:report` : evenements par type, IP suspectes, dernieres erreurs, alertes par seuil.
- Workflow `audit.yml` quotidien sur la production et la pre-production (rapport + `npm audit`),
  en echec avec e-mail si un seuil est depasse.

### Maintenance

- Dependances : actions GitHub (checkout 7, setup-node 7, upload-artifact 7, login-action 4,
  build-push-action 7) et nginx 1.31. Dependabot vise `develop` et regroupe ses mises a jour.

## [2.0.0] - 2026-11-27

Commits : a100145, 47ecf6d, a7a3a9e, 4d71be8, e0f7d87, 80f5534, 877260a, 559adc5, eaaf45f, 1bbc4a3, b7be6b1, f1d3041.

Mise en production : correction des bugs (E27) et des failles (E28), documentation (E29),
conteneurisation, CI/CD, journalisation et supervision (E21 a E26).

### Securite (E28)

| # | Faille du code fourni | Correction | Commit |
| --- | --- | --- | --- |
| S1 | IDOR sur `PUT` et `DELETE /api/tasks/:id` : aucune verification du proprietaire | Filtre `{ _id, user }`, reponse 404 | f1d3041 |
| S2 | `JWT_SECRET=secretkey123` livre avec le projet | Secret aleatoire de 48 octets par environnement, hors de git ; refus de demarrer sous 32 caracteres | f1d3041 |
| S3 | Jeton JWT dans `localStorage` (volable par XSS) | Cookie `httpOnly`, `Secure`, `SameSite=Strict` | f1d3041, b7be6b1 |
| S4 | Aucune validation des entrees : `<script>` enregistre tel quel | Schemas Joi, chevrons refuses, CSP | f1d3041 |
| S5 | Injection NoSQL : un operateur envoye comme nom d'utilisateur est execute dans la requete | Types stricts + `sanitizeFilter` | f1d3041 |
| S6 | CORS ouvert a toutes les origines | Meme origine, liste blanche `CORS_ORIGINS` | f1d3041 |
| S7 | Pas de limite de tentatives de connexion | 10 echecs / 15 min / IP | f1d3041 |
| S8 | Mot de passe d'un seul caractere accepte | 8 caracteres, lettre et chiffre, bcrypt cout 12 | f1d3041 |
| S9 | Pas d'en-tetes de securite, `X-Powered-By` expose | Helmet + en-tetes Vercel et nginx | f1d3041, 1bbc4a3 |
| S10 | Dependances vulnerables : 8 (2 critiques) backend, 67 (3 critiques) frontend | Express 5, Mongoose 9, React 19, Vite : 0 vulnerabilite | f1d3041, b7be6b1 |

Renforcements ajoutes (pas de faille constatee) : temps de reponse identique que le compte existe ou non, hash jamais
lu par defaut, corps de requete limite a 10 Ko, messages d'erreur generiques avec identifiant de requete.

### Corrections de bugs (E27)

| # | Bug du code fourni | Correction | Commit |
| --- | --- | --- | --- |
| B1 | Tache ajoutee invisible sans rafraichir (`addTask` vide) | Ajout immediat dans la liste | b7be6b1 |
| B2 | Tache sans titre : erreur 500, rien a l'ecran | Blocage cote interface + validation serveur (400) | b7be6b1, f1d3041 |
| B3 | Connexion sans mot de passe : erreur 500 | Validation des champs (400) | f1d3041 |
| B4 | Identifiant de tache mal forme : erreur 500 | Validation de l'identifiant (404) | f1d3041 |
| B5 | Jeton invalide : code HTTP 418 | Code 401 | f1d3041 |
| B6 | Aucun message en cas d'echec : seulement `console.error` | Composant `Alert` | b7be6b1 |
| B7 | Chargement des taches non gere (session expiree : liste vide) | Erreur geree, retour a la connexion | b7be6b1 |
| B8 | Impossible de terminer ou modifier une tache depuis l'interface | Case a cocher et edition | b7be6b1 |
| B9 | URL de l'API en dur sur localhost | URL relative `/api` | b7be6b1 |
| B10 | Pas de lien Inscription, deconnexion sans redirection | Corrige | b7be6b1 |
| B11 | Mise en page : scroll horizontal, `<header>` imbrique, `lang="en"` | CSS et HTML corriges | b7be6b1 |

Points fragiles corriges (pas de panne constatee) : `throw` dans le callback de `jwt.sign` ; `findByIdAndRemove`,
valide dans la version d'origine mais supprime des versions recentes de Mongoose ; options de connexion obsoletes.

Defauts introduits pendant la reecriture et corriges avant la mise en production (trouves par le test navigateur) :
formulaire partage entre Connexion et Inscription (80f5534), case a cocher lente (e0f7d87), message d'erreur
persistant (4d71be8).

### Ajouts

- Route de supervision `GET /api/health` (etat API + base) - f1d3041
- Journalisation Winston JSON : journal d'acces, evenements d'audit (`audit:*`), fichiers tournants en Docker - f1d3041
- Tests : 20 tests d'integration API (couverture 96 %), 11 tests d'interface (couverture 94 %) - f1d3041, b7be6b1
- ESLint et Prettier - f1d3041, b7be6b1
- Dockerfiles (utilisateur non root, healthcheck) et `docker-compose.yml` (MongoDB, API, nginx) - 1bbc4a3
- `scripts/smoke-test.sh` : 23 verifications de bout en bout sur un environnement deploye - 1bbc4a3
- `scripts/e2e-captures.mjs` : parcours complet dans Chromium (Playwright) + captures d'ecran - 80f5534
- CI/CD GitHub Actions, sonde de supervision, sauvegarde chiffree, Dependabot, deploiement Vercel preprod et production
- Documentation JSDoc generee (`npm run docs`) et specification OpenAPI (`docs/openapi.yaml`)

## [1.0.0] - 2025

Version d'origine fournie pour l'examen (commit 22d3245).
