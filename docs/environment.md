# Environnement & Configuration

## Serveur

- Windows Server avec IIS (site PHP sur port 80/443)
- SQL Server 16 en local (pour le site PHP seulement, PAS pour CrabCreate)
- Jenkins sur port 8080 (CI/CD existant)
- Bitbucket pour les repos (avec webhooks → Jenkins)
- CrabCreate tourne sur le meme serveur, port 3000

## Variables d'environnement

Fichier `.env` a la racine du projet.

```env
# Server
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# SQLite
DB_PATH=./db/kanban.db

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (GPT)
OPENAI_API_KEY=sk-...

# Bitbucket
BITBUCKET_USERNAME=
BITBUCKET_APP_PASSWORD=
BITBUCKET_WORKSPACE=
BITBUCKET_DEFAULT_REPO=

# Repos local clone path
REPOS_CLONE_PATH=C:/kanban-ai/repos

# DB docs — documentation SQL Server du site PHP
DB_DOCS_PATH=./db-docs

# Admin email (premier admin, seed)
ADMIN_EMAIL=admin@example.com

# JWT
JWT_SECRET=

# Email (Resend)
RESEND_API_KEY=

# Staging (optionnel)
STAGING_BASE_URL=https://staging.mysite.com

# Ngrok (pour webhooks)
NGROK_URL=

# Auto-repo GitHub (creation auto de repos a la creation de projet)
AUTO_REPO_GITHUB_TOKEN=ghp_xxx
AUTO_REPO_GITHUB_OWNER=mon-org
```

## Commandes

```bash
# Developpement (server + client concurrently)
npm run dev

# Server seul (node --watch)
cd server && npm run dev

# Client seul (Vite, port 5173)
cd client && npm run dev

# Build production
npm run build        # construit client/dist
npm start            # Express sert le build sur port 3000

# Lint
cd client && npm run lint

# TypeScript check
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit

# Setup initial (Windows)
setup.bat
```

## Fichiers sensibles (gitignored)

- `.env` — cles API, credentials
- `db-docs/` — schema SQL Server du site PHP (donnees internes)
- `server/db/kanban.db` — base de donnees SQLite
- `REPOS_CLONE_PATH` — clones de repos Bitbucket

## Production

- Express sert `client/dist` (fichiers statiques + SPA fallback)
- Utiliser pm2 ou node-windows pour garder le process alive
- HSTS active automatiquement en production
