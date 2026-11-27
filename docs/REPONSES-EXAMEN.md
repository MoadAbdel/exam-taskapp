# Rendu de l'examen : mise en production et maintenance applicative

Application : gestion de taches (React, Node.js/Express, MongoDB).
Code source : https://github.com/MoadAbdel/exam-taskapp (prive, acces sur demande).

---

## Etape 1 : conception, preparation et mise en place des environnements cloud

### E21 : choix de l'hebergement et environnement de pre-production

**Besoin.** L'application a un frontend statique (React), une API Node.js sans etat et une base MongoDB.
Le trafic est faible et irregulier. Le budget est nul. Les donnees doivent rester en Europe (RGPD).

**Comparaison.**

| Critere | Vercel + MongoDB Atlas (retenu) | Render | AWS (ECS + DocumentDB) | VPS Scaleway + Docker |
| ------- | ------------------------------- | ------ | ---------------------- | --------------------- |
| Cout pour ce projet | 0 EUR (Hobby + Atlas M0) | 0 EUR, mais mise en veille apres 15 min | 50 a 100 EUR/mois | 5 a 10 EUR/mois |
| Elasticite | Automatique (serverless + CDN) | Manuelle | Auto-scaling a configurer | Aucune |
| Maintenance | Aucun serveur a patcher | Faible | Forte | Forte (OS, Docker, TLS) |
| HTTPS | Automatique, renouvele | Automatique | ACM a configurer | Let's Encrypt a installer |
| Region | Paris (cdg1) pour l'API et la base | Francfort | Paris | Paris |
| Deploiement | Integration Git native, rollback instantane | Git | Pipeline a construire | Scripts a ecrire |

**Choix.** Vercel pour le frontend et l'API, MongoDB Atlas pour la base, tous deux a Paris.
Raisons : elasticite sans configuration (une fonction par requete, CDN mondial pour les fichiers),
cout nul a ce volume, aucun serveur a maintenir, HTTPS et deploiement atomique inclus.
Limites connues : duree d'execution par requete limitee (sans impact ici), demarrage a froid de quelques
centaines de millisecondes, Atlas M0 limite a 512 Mo sans sauvegarde automatique (compense par E26).
Evolution si la charge augmente : Vercel Pro + Atlas M10 (sauvegardes continues, ~60 EUR/mois au total).

**Architecture.** Un seul domaine par environnement : `/*` vers le frontend, `/api/*` vers l'API
(Vercel Services). Donc pas de CORS, et un cookie de session `SameSite=Strict`.

**Pre-production (qualification).** Projet Vercel `exam-taskapp-preprod`, deploye depuis la branche `develop`,
base dediee `taskapp_preprod`, secrets dedies. URL : https://exam-taskapp-preprod.vercel.app
Un environnement conteneurise existe aussi : `docker compose up` lance MongoDB, l'API et nginx
(images non root avec healthcheck, publiees sur GHCR par la CI).

### E22 : environnement de production securise

- Projet Vercel `exam-taskapp`, branche `main`, base `taskapp_prod` separee de la pre-production.
- Secrets dans Vercel (type "sensitive", chiffres, illisibles apres creation) : `MONGO_URI`, `JWT_SECRET`
  (48 octets aleatoires, different par environnement). Aucun secret dans git (`.env` ignore).
- L'API refuse de demarrer si un secret manque ou est trop court (validation Joi de la configuration).
- En-tetes HTTP : HSTS 2 ans + preload, Content-Security-Policy stricte, X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy. `X-Powered-By` supprime.
- API : validation de toutes les entrees, controle d'acces par proprietaire, limite de 10 tentatives de connexion
  par 15 min, corps limite a 10 Ko, injection NoSQL bloquee, erreurs sans detail technique.
- Base : acces par utilisateur dedie, connexion chiffree TLS, pas de port expose.
- Administration : tableau de bord Vercel (deploiements, logs, rollback en un clic), console Atlas.
- Verification : `scripts/smoke-test.sh` passe 23 controles sur la production (IDOR, XSS, NoSQL, en-tetes...).

### E23 : nom de domaine, DNS et certificats

Choix : sous-domaines fournis par Vercel, sans domaine achete pour l'examen.
- Production : `exam-taskapp.vercel.app`. Pre-production : `exam-taskapp-preprod.vercel.app`.
- DNS : enregistrements geres par Vercel (zone `vercel.app`), resolution verifiee.
- Certificats : certificat `*.vercel.app` emis par Google Trust Services, valide jusqu'au 29/01/2027,
  renouvele automatiquement. Verifie avec `openssl s_client` (sujet, emetteur, dates, SAN).
- HTTP redirige en 308 vers HTTPS. HSTS actif.

Procedure avec un domaine achete (ex. `mestaches.fr`) :
1. Reserver le domaine chez un registrar (OVH, Gandi) ou `vercel domains buy`. Renseigner les informations du titulaire (AFNIC pour un .fr).
2. Option A : remplacer les serveurs de noms par `ns1.vercel-dns.com` et `ns2.vercel-dns.com`.
   Option B : garder le DNS du registrar et creer `app CNAME cname.vercel-dns.com`, `preprod CNAME cname.vercel-dns.com`.
3. `vercel domains add app.mestaches.fr` sur le projet production, `preprod.mestaches.fr` sur le projet pre-production.
4. Ajouter un enregistrement CAA `0 issue "letsencrypt.org"` : seule cette autorite peut emettre un certificat.
5. Vercel obtient le certificat Let's Encrypt (challenge HTTP-01) et le renouvelle seul. Verifier avec SSL Labs (note A+ attendue grace a HSTS).

### E24 : deploiement automatise (CI/CD)

La meme chaine sert aux deux environnements. Seule la branche change.

1. **CI** (`.github/workflows/ci.yml`, a chaque push et pull request) :
   installation (`npm ci`), ESLint, Prettier, tests avec seuil de couverture (API 96 %, interface 95 %),
   `npm audit --audit-level=high`, build Vite, build des images Docker et publication sur GHCR.
2. **CD** : integration Git de Vercel. Push sur `develop` -> pre-production. Fusion dans `main` -> production.
   Chaque projet ignore les autres branches. Le deploiement est atomique (tout ou rien) et chaque version
   reste disponible pour un retour arriere instantane (`vercel rollback`).
3. **Verification apres deploiement** (`deploy.yml`) : quand Vercel annonce le succes, GitHub Actions lance
   le test de fumee de bout en bout sur l'URL publique.
4. **Dependances** : Dependabot propose chaque semaine les mises a jour (npm, images Docker, actions).

### E25 : journalisation et audit

- Winston, format JSON, une ligne par evenement, horodatage, environnement, identifiant de requete.
- Journal d'acces : methode, route, statut, duree, utilisateur, IP (niveau `warn` pour 4xx, `error` pour 5xx).
- Journal d'audit : `audit:inscription`, `audit:connexion`, `audit:connexion_echec` (avec IP), `audit:tache_supprimee`.
- Chaque reponse porte `X-Request-Id` : on retrouve une erreur signalee par un utilisateur dans les logs.
- Pre-production et production : logs consultables et filtrables dans Vercel (Logs, filtre par statut, route, niveau).
- Docker : fichiers `logs/error.log` et `logs/combined.log` avec rotation (5 x 5 Mo), dans un volume.
- Audit des dependances : `npm audit` dans la CI (bloquant), Dependabot. Audit de securite : test de fumee.
- Aucun secret ni mot de passe n'est journalise.

### E26 : supervision et alertes

- Sonde de sante `GET /api/health` : etat de l'API, ping de la base, environnement, version.
- Sonde externe (`.github/workflows/uptime.yml`) toutes les 15 minutes sur les deux environnements.
  Alertes (e-mail GitHub si echec) : API indisponible (HTTP different de 200), base injoignable (`db` different de `up`),
  latence superieure a 2 s, frontend indisponible.
- Alerte de deploiement : le test post-deploiement echoue -> commit rouge + e-mail.
- Vercel : Observability (erreurs 5xx, durees des fonctions), notifications d'echec de build et d'usage.
- Atlas : alertes de la console (connexions, stockage proche de 512 Mo, echecs d'authentification).
- Docker : `healthcheck` sur chaque conteneur, redemarrage automatique (`restart: unless-stopped`).
- Sauvegarde : `backup.yml`, chaque nuit, `mongodump` de la production, chiffre en AES-256, conserve 30 jours.
  Restauration documentee (`mongorestore`). Tolerance de panne : Atlas M0 est un replica set de 3 noeuds.

---

## Etape 2 : qualite du code, securite et documentation

### E27 : bugs detectes et corriges

Methode : tests manuels de chaque fonction, lecture du code, puis tests automatises (API, interface, navigateur).

1. Tache ajoutee invisible sans rafraichir la page (`addTask` vide) -> ajout immediat dans la liste.
2. Formulaires vides envoyes : tache sans titre -> erreur 500 silencieuse -> blocage cote client + validation serveur (400 avec message).
3. Aucun retour en cas d'erreur (mauvais login, serveur en panne) -> zone de message accessible (`role="alert"`).
4. Suppression impossible : `findByIdAndRemove` n'existe plus dans Mongoose recent -> `findOneAndDelete`.
5. Jeton invalide renvoye en HTTP 418 -> 401.
6. `throw` dans le callback de `jwt.sign` : peut arreter le serveur -> signature synchrone dans le `try`.
7. Erreurs async non capturees (Express 4) -> Express 5 + gestionnaire d'erreurs central.
8. `PUT` efface les champs non envoyes -> mise a jour partielle.
9. ID mal forme -> 500 -> 404.
10. `/tasks` accessible sans session, ecran vide si jeton expire -> route protegee, retour au login.
11. Impossible de cocher ou modifier une tache dans l'interface -> case a cocher et edition.
12. URL de l'API en dur sur localhost -> URL relative `/api`.
13. Pas de lien Inscription, deconnexion sans redirection -> corrige.
14. Mise en page : scroll horizontal (100vw), en-tete imbrique, `lang="en"`, annee figee -> corrige.
15. Trouves par le test navigateur : etat du formulaire partage entre Connexion et Inscription ;
    case a cocher lente a reagir ; message d'erreur qui reste affiche -> corriges.

Preuves : 20 tests API, 12 tests d'interface, scenario Chromium, captures dans `docs/captures/`.

### E28 : failles de securite detectees et corrigees

| Faille | Risque | Correction |
| ------ | ------ | ---------- |
| IDOR sur PUT/DELETE `/api/tasks/:id` | Modifier ou supprimer les taches des autres | Filtre `{ _id, user }`, reponse 404 |
| `JWT_SECRET=secretkey123` versionne | Forger un jeton pour n'importe quel compte | Secret de 48 octets aleatoires par environnement, dans Vercel ; refus de demarrer si < 32 caracteres |
| Jeton dans `localStorage` | Vol par XSS | Cookie httpOnly, Secure, SameSite=Strict, 1 h |
| Pas de validation (`<script>alert('test')</script>` accepte) | XSS stocke, donnees invalides | Joi : longueurs, motifs, `<` et `>` refuses, champs inconnus refuses ; React n'interprete pas le HTML ; CSP |
| Injection NoSQL `{"$ne": null}` | Contourner les filtres | Types stricts + `sanitizeFilter` |
| CORS ouvert a tous | Appels depuis n'importe quel site | Meme origine, liste blanche |
| Force brute sur le login | Deviner un mot de passe | 10 essais / 15 min / IP |
| Mot de passe vide ou faible | Comptes faciles a pirater | 8 caracteres, lettre + chiffre, bcrypt cout 12 |
| Enumeration des comptes | Decouvrir les noms d'utilisateur | Meme message et meme temps de reponse |
| Pas d'en-tetes de securite | Clickjacking, sniffing | Helmet + en-tetes Vercel/nginx |
| Dependances : 75 vulnerabilites dont 5 critiques | Failles connues | Mises a jour (Express 5, Mongoose 9, React 19, Vite remplace Create React App) : 0 vulnerabilite |
| Corps de requete sans limite | Deni de service | 10 Ko maximum |
| Erreurs techniques renvoyees | Fuite d'information | Message generique + identifiant de requete |

Verification : chaque faille a un test automatise, et `scripts/smoke-test.sh` les rejoue sur la production.

### E29 : documentation et journal des evolutions

- Code commente en JSDoc (API) et commentaires de composants (React) : role, parametres, retours, bug corrige.
- Documentation generee depuis le code : `npm run docs` (JSDoc) -> `docs/api/index.html`.
- Documentation de l'API pour les tiers : `docs/openapi.yaml` (OpenAPI 3.1, utilisable dans Swagger UI).
- `CHANGELOG.md` au format Keep a Changelog : versions 2.0.0 puis 1.0.0 (ordre decroissant),
  sections Securite / Corrections / Ajouts, chaque ligne liee a son commit.
- `README.md` : architecture, lancement local et Docker, commandes qualite, CI/CD, configuration.

---

## Etape 3 : lien de l'application deployee

- Production : **https://exam-taskapp.vercel.app**
- Pre-production : https://exam-taskapp-preprod.vercel.app
- Sonde de sante : https://exam-taskapp.vercel.app/api/health

Acces pour la verification : creer un compte depuis la page Inscription (ouverte a tous).
Code, CI et historique : depot GitHub `MoadAbdel/exam-taskapp` (acces en lecture accorde sur demande).
