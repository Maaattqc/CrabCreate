# Architecture

## Vue d'ensemble

**CrabCreate** est un dashboard Kanban interne pour automatiser le developpement sur un site PHP existant. L'utilisateur cree des tickets, une IA (Claude ou GPT-5) code les modifications, push sur Bitbucket, review automatique, puis deploy via Jenkins.

Langue du projet : francais (UI, commentaires). Le code mixe francais/anglais.

## Monorepo

```
kanban-ai/
├── client/          React 19 + Vite 8 + Tailwind CSS 4 + TypeScript
├── server/          Node.js + Express 5 + TypeScript
├── db-docs/         Doc SQL Server du site PHP (LOCAL, gitignore)
├── docs/            Documentation technique (ce dossier)
├── setup.bat        Script d'installation Windows
└── package.json     Root — concurrently pour dev
```

Le root `package.json` utilise `concurrently` pour lancer server + client en dev.

## Server (`server/`)

Entrypoint : `server/index.ts`

```
server/
├── index.ts              Express app, routes, middleware chain
├── config.ts             Chargement .env
├── socket.ts             Socket.io setup
├── schemas.ts            Schemas Zod (validation)
├── types.ts              Types TypeScript partagees
├── middleware/
│   ├── auth.ts           JWT verification (requireAuth, requireAdmin)
│   ├── validate.ts       Middleware Zod generique
│   ├── rate-limit.ts     Rate limiter global API
│   └── maintenance.ts    Mode maintenance
├── routes/
│   ├── auth.ts           Login (email code), logout, /me, preferences
│   ├── tickets.ts        CRUD tickets
│   ├── pipeline.ts       Launch/approve/reject/retry/rollback
│   ├── chat.ts           Chat avec l'IA par ticket
│   ├── prompts.ts        System prompt editor
│   ├── analytics.ts      Stats agregees
│   ├── settings.ts       Admin settings (51 cles configurables)
│   ├── admin.ts          Gestion users, audit logs
│   ├── contact.ts        Formulaire contact public
│   └── webhooks.ts       Webhooks Bitbucket
├── services/
│   ├── ai-coder.ts       Appel Claude/GPT pour generer du code
│   ├── ai-reviewer.ts    2e passe IA — code review (score /100)
│   ├── ai-client.ts      Factory client IA (Anthropic/OpenAI)
│   ├── repo-reader.ts    Clone/pull repos Bitbucket, lit fichiers cibles
│   ├── db-docs-reader.ts Lit db-docs/ pour contexte DB dans les prompts
│   ├── bitbucket.ts      API REST Bitbucket (clone, push, PR, merge)
│   ├── file-locker.ts    File locking entre tickets concurrents
│   ├── dependency-checker.ts  Resolution dependances tickets
│   ├── deployer.ts       Deploy staging + merge prod
│   ├── queue.ts          Job queue SQLite (polling)
│   ├── test-generator.ts Tests PHPUnit generes par IA
│   └── email.ts          Envoi d'emails (codes auth)
└── db/
    ├── sqlite.ts         Connection better-sqlite3
    ├── migrations.ts     Creation tables + migrations colonnes
    ├── repositories.ts   Couche data access (queries)
    └── kanban.db         Fichier SQLite (auto-cree)
```

## Client (`client/src/`)

```
client/src/
├── App.tsx                   Routes React Router, providers
├── main.tsx                  Point d'entree React
├── types.ts                  Types TypeScript
├── i18n.ts                   Traductions FR/EN
├── api/
│   └── tickets.ts            Appels API REST
├── constants/
│   └── index.ts              Colonnes, priorites, templates, modeles IA
├── hooks/
│   ├── useAuth.ts            Authentification + AuthProvider
│   ├── useTickets.ts         CRUD tickets
│   ├── useSocket.ts          Socket.io client
│   ├── useNotifications.ts   Notifications toast
│   ├── useTheme.ts           Theme clair/sombre
│   ├── useLanguage.ts        Langue FR/EN
│   ├── useAnimations.ts      Toggle animations
│   └── useAIDesign.ts        Toggle design IA
├── components/
│   ├── auth/                 LoginPage
│   ├── admin/                AdminPage (settings, users, audit)
│   ├── public/               Landing, Pricing, Contact, Legal, Privacy, 404
│   ├── layout/               Header, NotificationToast, CommandPalette, etc.
│   ├── board/                KanbanBoard, Column, TicketCard, ListView, etc.
│   ├── modals/               CreateTicketModal, TicketDetailModal, SettingsModal
│   ├── detail-tabs/          Terminal, Diff, AIReview, Tests, Chat, Activity
│   └── analytics/            AnalyticsPage
```

## Middleware chain (ordre dans index.ts)

```
1. Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
2. CORS + JSON body parser + cookie parser
3. Rate limiter global (/api)
4. Routes publiques : /api/auth, /api/contact, /api/webhooks, /api/plans
5. requireAuth gate (JWT cookie)
6. /api/app-config (config UI pour users authentifies)
7. maintenanceGuard (bloque non-admin si maintenance_mode=1)
8. Routes protegees : tickets, pipeline, chat, prompts, analytics, settings, admin
9. Static files (production) : client/dist + SPA fallback
```

## Temps reel

**Socket.io** — le serveur emet, le client ecoute. Aucun event client→server (tout passe par REST).

Events :
- `ticket:log` — logs en temps reel pendant le pipeline
- `ticket:status` — changement de statut + progress
- `ticket:updated` — rechargement ticket
- `notification` — notification toast

## Authentification

Login par email + code OTP (6 chiffres). JWT stocke dans un cookie httpOnly (`crab_token`). Premier utilisateur inscrit = admin automatique. Routes dev-login en developpement.

## Patterns architecturaux

### Server — Repository pattern

La couche d'acces aux donnees est centralisee dans `server/db/repositories.ts`. Les routes et services n'utilisent jamais `db.prepare()` directement — ils importent `* as repo` et appellent des fonctions nommees.

```
Route/Service  →  repositories.ts  →  sqlite.ts (better-sqlite3)
```

Exemple :
```typescript
// Dans une route
import * as repo from '../db/repositories';
const ticket = repo.findTicketById(id);
```

### Server — Middleware pattern

Chaque middleware est un fichier independant dans `server/middleware/`. La validation Zod est generique via `validate(schema)` qui retourne un middleware Express.

```typescript
// Usage dans une route
router.post('/', validate(mySchema), (req, res) => { ... });
```

### Server — Config dynamique

Les settings sont lus a la volee depuis `kanban_config` via `repo.getConfig(key)`. Pas de cache — chaque appel lit la DB. Pour express-rate-limit, seul `limit` est dynamique (via fonction), `windowMs` est statique.

### Client — Providers / Context

L'app utilise des providers React imbriques dans `App.tsx` :

```
ThemeProvider → AnimationsProvider → AIDesignProvider → LanguageProvider → AuthProvider
```

Chaque provider expose un hook (`useTheme`, `useAuth`, etc.) via `React.createContext`.

### Client — Hooks personnalises

- **useTickets** : CRUD complet avec state local (`tickets[]`), expose `create`, `remove`, `launch`, `approve`, `reject`, `retry`, `rollback`, `updateTicketInState`
- **useSocket** : Wrapper Socket.io avec `on`/`off`/`emit`
- **useNotifications** : State + auto-dismiss configurable
- **useAuth** : Login/logout, `user` state, charge `/api/auth/me` au mount

### Client — API layer

`client/src/api/tickets.ts` centralise tous les appels `fetch()`. Les hooks et composants n'appellent jamais `fetch` directement.

### Client — i18n

Systeme maison dans `client/src/i18n.ts`. Interface `Translations` avec toutes les cles typees. Objets `fr` et `en`. Hook `useLanguage()` retourne `{ t, lang, toggleLang }`.

### Client — Routing

React Router v6 avec `<Routes>` dans `AppRoutes`. Pages publiques wrappees dans `<PublicLayout>` (navbar + footer). Pages protegees wrappees dans `<ProtectedRoute>` (redirect si pas auth). Page login wrappee dans `<AuthRedirect>` (redirect si deja auth).
