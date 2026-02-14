# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CrabCreate** — dashboard Kanban interne pour automatiser le developpement PHP. L'utilisateur cree des tickets, une IA (Claude/GPT-5) code les modifications, push Bitbucket, review automatique, deploy via Jenkins. Langue du projet : francais (UI, commentaires mixent FR/EN).

## Commands

```bash
npm run dev                     # Dev server + client (concurrently)
cd server && npm run dev        # Server seul (node --watch)
cd client && npm run dev        # Client seul (Vite, port 5173)
npm run build                   # Build client/dist
npm start                       # Production (Express, port 3000)
cd client && npm run lint       # ESLint
cd client && npx tsc --noEmit   # TypeScript check client
cd server && npx tsc --noEmit   # TypeScript check server
setup.bat                       # Setup initial Windows
```

## Documentation

Documentation complete dans le dossier `docs/` :

- **[docs/architecture.md](docs/architecture.md)** — Structure monorepo, server, client, middleware chain, patterns (repository, providers, hooks)
- **[docs/database.md](docs/database.md)** — Schema SQLite complet (11 tables), statuts, migrations, seeds
- **[docs/api-routes.md](docs/api-routes.md)** — Toutes les routes REST + Socket.io events
- **[docs/pipeline.md](docs/pipeline.md)** — Flow complet du pipeline IA (10 etapes), job queue, db-docs
- **[docs/admin-settings.md](docs/admin-settings.md)** — 51 settings configurables, categories, types, notes techniques
- **[docs/testing.md](docs/testing.md)** — Conventions de tests, commandes, patterns Vitest + Testing Library
- **[docs/environment.md](docs/environment.md)** — Variables .env, commandes, fichiers sensibles, production
- **[docs/design.md](docs/design.md)** — Theme, couleurs, typographie, composants UI, pages publiques

## Regles de developpement

- **Tests obligatoires** : tout nouveau code testable (hook, composant, route, utilitaire, schema) doit avoir des tests Vitest correspondants. Voir [docs/testing.md](docs/testing.md).
- **Repository pattern** : les routes/services ne font jamais de `db.prepare()` directement — passer par `repositories.ts`.
- **Validation Zod** : toute route qui accepte un body doit utiliser le middleware `validate(schema)`.
- **i18n** : tout texte visible dans l'UI doit etre dans `i18n.ts` (FR + EN).
- **TypeScript strict** : verifier avec `npx tsc --noEmit` avant de finaliser.

## Conventions UI

- **Pas de date d'echeance a la creation** : le champ `due_date` n'apparait qu'a l'edition du ticket, jamais dans `CreateTicketModal`.
- **Dollar apres le nombre** : format `49$`, `0$`, pas `$49`. Applique partout dans `i18n.ts`, Header, tests.
- **`color-scheme` CSS** : toujours mettre `color-scheme: dark` sur `:root` / `[data-theme="dark"]` et `color-scheme: light` sur `[data-theme="light"]` dans `index.css`. Sans ca, les icones natives (calendrier, fleches select, etc.) restent noires en dark mode.

## Quick Reference

- **Stack** : React 19 + Vite 8 + Tailwind CSS 4 (client) / Node.js + Express 5 (server) / TypeScript / SQLite (better-sqlite3)
- **DB** : `server/db/kanban.db` (auto-cree), 11 tables, synchrone
- **Auth** : Email OTP → JWT cookie httpOnly (`crab_token`)
- **Temps reel** : Socket.io (server→client only)
- **AI** : Anthropic SDK + OpenAI SDK, modeles configurables en admin
- **Settings** : 51 cles dans `kanban_config`, admin UI, validation Zod
- **i18n** : FR/EN dans `client/src/i18n.ts`
- **`db-docs/`** : Doc SQL Server du site PHP (gitignore, injecte dans prompts IA)
