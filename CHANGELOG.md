# Journal des evolutions

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions : [SemVer](https://semver.org/lang/fr/).
Les versions sont listees de la plus recente a la plus ancienne. Chaque entree cite le commit qui la porte.

## [2.4.0] - 2026-11-27

### Conformite RGPD

- Page "Confidentialite" : donnees, finalites, bases legales, durees, sous-traitants, cookie, droits, CNIL.
- Page "Mon compte" : export JSON des donnees (acces, portabilite) et suppression du compte avec mot de passe
  (effacement) ; la piste d'audit est anonymisee.
- Minimisation : IP tronquees et noms d'utilisateur retires avant envoi a Grafana ; IP tronquees et noms masques
  dans le rapport d'audit (publie dans les journaux CI d'un depot public), messages d'erreur retires du rapport.
- Cookie de session strictement necessaire : pas de bandeau de consentement. Aucun e-mail collecte : pas d'opt-in.
## [2.3.0] - 2026-11-27

### Ajouts (E25 et E26)

- Envoi des logs et evenements d'audit de la pre-production et de la production vers Grafana Cloud (Loki),
  par lots, apres la reponse (`waitUntil`) : aucune attente pour l'utilisateur. Une panne de Loki ne bloque rien.
- Journal d'acces : ajout du modele de route (`route`).
- 4 tests du transport Loki.
- Grafana Cloud : sondes Paris et Francfort, un tableau de bord par environnement, 6 alertes
  (`monitoring/grafana-cloud/setup.mjs`).

## [2.2.0] - 2026-11-27

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

Mise en production : correction des bugs (E27) et des failles (E28), documentation (E29),
conteneurisation, CI/CD, journalisation et supervision (E21 a E26).

### Securite (E28)

| # | Faille | Risque | Correction | Commit |
| - | ------ | ------ | ---------- | ------ |
| S1 | IDOR sur `PUT` et `DELETE /api/tasks/:id` : aucune verification du proprietaire | Un utilisateur connecte modifie ou supprime les taches des autres en changeant l'ID | Filtre `{ _id, user: req.user.id }` dans `findOneAndUpdate` / `findOneAndDelete`, reponse 404 | f1d3041 |
| S2 | `JWT_SECRET=secretkey123` dans `.env`, fichier versionne | Secret devinable : n'importe qui forge un jeton valide | Secret aleatoire de 48 octets par environnement, stocke dans Vercel (chiffre). L'API refuse de demarrer si le secret fait moins de 32 caracteres (`config/env.js`). `.env` ignore par git | f1d3041 |
| S3 | Jeton JWT dans `localStorage` | Volable par tout script injecte (XSS) | Cookie `httpOnly`, `Secure`, `SameSite=Strict`, `path=/api`, duree 1 h. Plus de jeton cote JavaScript | f1d3041, b7be6b1 |
| S4 | Aucune validation des entrees (HTML/JS accepte, champs inconnus, types libres) | XSS stocke, donnees incoherentes, ecrasement de champs | Schemas Joi stricts (longueurs, motifs, champs inconnus refuses), chevrons `< >` refuses | f1d3041 |
| S5 | Injection NoSQL : `{"username": {"$ne": null}}` accepte au login | Contournement de requetes | Validation de type (chaines) + `mongoose.set('sanitizeFilter', true)` | f1d3041 |
| S6 | CORS ouvert a toutes les origines (`app.use(cors())`) | N'importe quel site appelle l'API | Meme origine par defaut, liste blanche `CORS_ORIGINS` | f1d3041 |
| S7 | Pas de limite de tentatives de connexion | Force brute sur les mots de passe | `express-rate-limit` : 10 echecs / 15 min / IP | f1d3041 |
| S8 | Pas d'en-tetes de securite, `X-Powered-By: Express` | Clickjacking, sniffing MIME, fuite de version | `helmet` (API) + en-tetes HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (Vercel et nginx) | f1d3041, 1bbc4a3 |
| S9 | Dependances vulnerables : 8 (dont 2 critiques) backend, 67 (dont 3 critiques) frontend | Failles connues exploitables | Mise a jour : Express 5, Mongoose 9, bcryptjs 3, React 19 ; Create React App (abandonne) remplace par Vite. `npm audit` : 0 vulnerabilite. Dependabot active | f1d3041, b7be6b1 |
| S10 | Mot de passe vide ou faible accepte, cout bcrypt 10 | Comptes faciles a compromettre | 8 caracteres minimum avec lettre et chiffre, bcrypt cout 12 | f1d3041 |
| S11 | Enumeration des comptes par le temps de reponse du login | Decouverte des noms d'utilisateur | `bcrypt.compare` execute aussi pour un compte inexistant | f1d3041 |
| S12 | Hash du mot de passe lisible par defaut dans les requetes | Fuite du hash dans une reponse | `select: false` + suppression dans `toJSON` | f1d3041 |
| S13 | Corps de requete sans limite de taille | Deni de service | `express.json({ limit: '10kb' })` | f1d3041 |
| S14 | Messages d'erreur techniques et `console.error` | Fuite d'information, pas de trace exploitable | Gestionnaire d'erreurs central, message generique + `requestId`, journal Winston JSON | f1d3041 |

### Corrections de bugs (E27)

| # | Bug | Correction | Commit |
| - | --- | ---------- | ------ |
| B1 | Une tache ajoutee n'apparait qu'apres rafraichissement (`addTask` vide) | Ajout en tete de liste avec `setTasks(prev => [task, ...prev])` | b7be6b1 |
| B2 | Formulaires vides envoyes (tache sans titre : erreur 500 silencieuse) | Verification cote client + validation Joi cote serveur (400 avec message) | b7be6b1, f1d3041 |
| B3 | Aucun message en cas d'echec (mauvais login, erreur serveur) : seulement `console.error` | Composant `Alert` (`role="alert"`) avec le message de l'API | b7be6b1 |
| B4 | `findByIdAndRemove` n'existe plus dans Mongoose 8+ : la suppression plante | `findOneAndDelete` | f1d3041 |
| B5 | Jeton invalide renvoie le code HTTP 418 (I'm a teapot) | 401 et effacement du cookie | f1d3041 |
| B6 | `jwt.sign` avec `throw` dans un callback : une erreur arrete tout le processus | Signature synchrone dans le `try` | f1d3041 |
| B7 | Erreurs async non capturees par Express 4 (requete bloquee) | Express 5 + gestionnaire d'erreurs central | f1d3041 |
| B8 | `PUT` ecrase les champs non envoyes avec `undefined` | Mise a jour partielle des seuls champs valides | f1d3041 |
| B9 | ID mal forme dans l'URL : erreur 500 (CastError) | Validation de l'ID, reponse 404 | f1d3041 |
| B10 | `/tasks` accessible sans session, ecran vide si le jeton expire | `ProtectedRoute` + session verifiee par `GET /api/auth/me`, retour au login si 401 | b7be6b1 |
| B11 | Impossible de marquer une tache terminee ou de la modifier depuis l'interface | Case a cocher + edition du titre | b7be6b1 |
| B12 | Suppression basee sur un etat perime (`tasks.filter` dans une closure) | Mises a jour fonctionnelles de l'etat | b7be6b1 |
| B13 | Pas de lien Inscription, deconnexion sans redirection, inscription sans connexion | Liens dans l'en-tete, redirection, connexion automatique apres inscription | b7be6b1 |
| B14 | URL de l'API en dur (`http://localhost:5000`) : ne marche pas en production | URL relative `/api` (meme origine) | b7be6b1 |
| B16 | Trouve par le test navigateur : React reutilise le formulaire entre Connexion et Inscription, l'erreur et la saisie d'une page restent sur l'autre | Cle (`key`) differente par page | 80f5534 |
| B17 | Trouve par le test navigateur : la case "terminee" ne reagit qu'apres la reponse serveur | Mise a jour optimiste avec retour arriere en cas d'echec | e0f7d87 |
| B18 | Le message d'erreur d'ajout reste affiche apres correction | Effacement a la saisie | 4d71be8 |
| B15 | Mise en page : `100vw` cree un scroll horizontal, `<header>` imbrique, `lang="en"`, annee figee 2025, options Mongoose obsoletes | CSS corrige, HTML semantique, `lang="fr"`, annee dynamique, options retirees | b7be6b1, f1d3041 |

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
