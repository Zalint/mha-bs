# Déploiement sur Render

Procédure pas-à-pas pour déployer le POC Bureau de Suivi MHA sur Render.com.

## Pré-requis

- Compte Render (plan Starter recommandé, ~14 $/mois pour le backend + DB).
- Repo Git accessible par Render (GitHub, GitLab ou Bitbucket).
- Clé API Resend pour l'envoi de mails (optionnel mais recommandé).
- Domaine `mha.sn` ou sous-domaine si besoin de personnaliser les URLs.

## Étape 1 — Création du blueprint

1. Pousser le code sur la branche `main` du repo.
2. Sur le dashboard Render, cliquer sur **New +** → **Blueprint**.
3. Sélectionner le repo `mha-bs`.
4. Render détecte automatiquement `render.yaml` à la racine.
5. Valider la création. Les services suivants seront provisionnés :
   - `mha-bs-db` (PostgreSQL 15, plan Starter)
   - `mha-bs-api` (Web Service Node.js, plan Starter, disque 1 Go)
   - `mha-bs` (Static Site)
   - `mha-bs-rapport-hebdo` (Cron Job)
   - `mha-bs-alertes-nightly` (Cron Job)

## Étape 2 — Variables d'environnement manuelles

Certaines variables ne peuvent pas être auto-générées. À renseigner dans le dashboard de chaque service :

| Variable | Service | Action |
|---|---|---|
| `BOOTSTRAP_ADMIN_PASSWORD` | `mha-bs-api` | Mot de passe initial admin (à changer après premier login) |
| `RESEND_API_KEY` | `mha-bs-api`, `mha-bs-rapport-hebdo` | Clé API Resend |

## Étape 3 — Initialisation de la base

Lors du premier déploiement, le `preDeployCommand` du service `mha-bs-api` exécute automatiquement `database/schema.sql`. La base contient alors les tables et les seeds référentiels (directions, sessions, députés).

Pour créer l'admin et importer les données POC :

```bash
# Depuis le shell Render du service mha-bs-api
npm run db:bootstrap-admin
npm run db:migrate-excel
```

Le fichier Excel doit être présent dans le repo (`mockups/SUIVIACTION MINISTERIELLE MHA.xlsx`) ou téléversé manuellement.

## Étape 4 — Vérifications

- `https://mha-bs-api.onrender.com/api/healthz` doit renvoyer `{ "status": "ok" }`.
- `https://mha-bs.onrender.com` doit afficher la page de login.
- Tester un login avec l'admin créé.

## Étape 5 — Domaine personnalisé (optionnel)

Pour utiliser `bs.mha.sn` au lieu de `mha-bs.onrender.com` :

1. Ajouter le custom domain dans le dashboard du service `mha-bs`.
2. Configurer un enregistrement CNAME : `bs.mha.sn` → `mha-bs.onrender.com`.
3. Render gère automatiquement le certificat SSL via Let's Encrypt.
4. Mettre à jour `PUBLIC_URL` et `CORS_ALLOWED_ORIGINS` dans `mha-bs-api`.

## Surveillance et logs

- Logs en temps réel : dashboard Render → service → onglet **Logs**.
- Métriques système (CPU, RAM, requêtes) : onglet **Metrics**.
- Alertes : Render envoie des emails automatiques en cas d'incident (5xx, OOM, etc.).

## Backups

Render PostgreSQL Starter inclut **7 jours de backups quotidiens** automatiques. Pour les backups long-terme, configurer un export hebdomadaire vers un bucket S3-compatible via un Cron Job dédié.

## Coûts estimés (mai 2026, Starter plan)

| Service | Coût mensuel |
|---|---|
| PostgreSQL Starter | 7 $ |
| Web Service Starter (avec disque 1 Go) | 7 $ |
| Static Site | gratuit |
| Cron Job × 2 | 2 $ |
| **Total** | **~16 $/mois** |

## Migration future vers un plan supérieur

Quand le volume augmente :
- **Standard plan** : 25 $/mois pour la DB (3 Go RAM, 50 Go stockage).
- **Pro plan** : à partir de 85 $/mois pour le web service (4 Go RAM, autoscaling).

Le disque persistant ne suit pas l'autoscaling : prévoir une migration vers Cloudflare R2 ou S3 pour les pièces jointes.
