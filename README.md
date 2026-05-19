# MHA · Bureau de Suivi

Outil de suivi des recommandations ministérielles pour le Bureau de Suivi du Ministère de l'Hydraulique et de l'Assainissement (Sénégal).

## Stack

- **Backend** : Node.js 20 LTS + Express 4 + TypeScript
- **Base de données** : PostgreSQL 15+ (Render)
- **Frontend** : React 18 + Vite + TypeScript + Tailwind CSS (PWA)
- **Auth** : JWT (interne) + x-api-key (externe)
- **Hébergement** : Render (PostgreSQL + Web Service + Static Site)

## Conventions

- **camelCase strict partout** : code, JSON API, tables et colonnes PostgreSQL.
- **Format de date unique** : `YYYY-MM-DD`.
- **Aucune `alert()` JavaScript** : toasts via `sonner`, confirmations via modales Radix.
- **Sécurité XSS** : échappement systématique des entrées utilisateur.
- **Pas de mapping snake/camel** : la base PostgreSQL utilise des identifiants quotés en camelCase.

## Structure du mono-repo

```
mha-bs/
├── backend/         API Express + TypeScript
├── frontend/        PWA React + Vite + TypeScript
├── shared/          Schémas Zod et types partagés
├── database/        schema.sql (PostgreSQL pré-build)
├── scripts/         migration Excel, bootstrap admin
├── mockups/         maquettes HTML statiques (référence design)
└── docs/            documentation technique et utilisateur
```

## Démarrage rapide

### Prérequis

- Node.js 20 LTS (`nvm use` lit `.nvmrc`)
- PostgreSQL 15+ local ou compte Render
- npm 10+

### Installation

```bash
git clone <repo-url>
cd mha-bs
npm install
cp .env.example .env
# éditer .env avec les valeurs locales
```

### Préparer la base de données

```bash
# Créer la base locale (si développement local)
createdb mha_bs

# Exécuter le schéma
npm run db:schema

# Créer l'utilisateur admin initial
npm run db:bootstrap-admin

# Migrer les 198 directives du POC depuis l'Excel
npm run db:migrate-excel
```

### Lancer en développement

```bash
npm run dev
```

- Backend : http://localhost:3001
- Frontend : http://localhost:5173

### Commandes utiles

| Commande | Description |
|---|---|
| `npm run dev` | Lance backend et frontend en parallèle |
| `npm run build` | Build complet pour production |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run lint:fix` | Corrige automatiquement |
| `npm run format` | Formate avec Prettier |
| `npm run typecheck` | Vérifie les types TypeScript |
| `npm run test` | Lance tous les tests |
| `npm run db:schema` | Applique `database/schema.sql` |
| `npm run db:bootstrap-admin` | Crée le user admin initial |
| `npm run db:migrate-excel` | Importe les directives depuis l'Excel |

## Déploiement sur Render

Voir [`docs/deploiement-render.md`](docs/deploiement-render.md).

## Documentation

- `docs/architecture.md` — Architecture technique détaillée
- `docs/api.md` — Surface API interne et externe (OpenAPI à venir)
- `docs/guide-bs.md` — Guide utilisateur Bureau de Suivi
- `docs/runbook.md` — Procédures opérationnelles

## Licence

Propriétaire — Ministère de l'Hydraulique et de l'Assainissement, République du Sénégal.
