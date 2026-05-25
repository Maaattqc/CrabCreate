# CrabCreate

[🇬🇧 Read in English](README.en.md)


> Dashboard Kanban AI-powered qui automatise le cycle de développement — de la création du ticket jusqu'au déploiement en production, sans intervention manuelle.

## Stack complète

### 🎨 Frontend
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat&logo=reactrouter&logoColor=white)

| Librairie | Usage |
|-----------|-------|
| `react` 19 | UI SPA |
| `react-router-dom` 7 | Routing client |
| `tailwindcss` 4 | Styling utilitaire |
| `lucide-react` | Icônes |
| `@dnd-kit` | Drag & drop Kanban |
| `socket.io-client` | WebSocket temps réel |
| `react-markdown` + `remark-gfm` | Rendu Markdown |
| `diff2html` | Affichage diffs de code |
| `axios` | HTTP client |

### ⚙️ Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)

| Librairie | Usage |
|-----------|-------|
| `express` 5 | Serveur HTTP/REST |
| `socket.io` | WebSocket temps réel |
| `jsonwebtoken` | Auth JWT cookie httpOnly |
| `nodemailer` | Email OTP via SMTP |
| `zod` | Validation des schemas |
| `helmet` | Sécurité HTTP headers |
| `express-rate-limit` | Rate limiting |
| `cors` | CORS policy |
| `cookie-parser` | Parsing cookies |
| `simple-git` | Opérations git programmatiques |
| `diff` | Génération de diffs |
| `blake3-wasm` | Hashing rapide (Cloudflare Pages) |
| `tsx` | Exécution TypeScript direct |

### 🗄️ Base de données
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

| Librairie | Usage |
|-----------|-------|
| `better-sqlite3` | SQLite synchrone, haute performance |
| Migrations custom | Versioning du schéma DB |

### 🤖 AI & APIs externes
![Anthropic](https://img.shields.io/badge/Anthropic_Claude-D4A027?style=flat&logo=anthropic&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI_GPT-412991?style=flat&logo=openai&logoColor=white)

| Service | Usage |
|---------|-------|
| `@anthropic-ai/sdk` | Claude (Sonnet/Opus) pour génération de code |
| `openai` | GPT-5.3 fallback |
| `stripe` | Paiements & abonnements |
| Bitbucket API | Push commits, création de PRs |
| Cloudflare Pages API | Deploy automatique des previews |
| GitHub API | Création automatique de repos |
| SMTP (Gmail) | Envoi OTP par email |

### 🧪 Tests
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)

| Librairie | Usage |
|-----------|-------|
| `vitest` | Tests unitaires (backend) |
| `@testing-library/react` | Tests composants React |
| `@testing-library/jest-dom` | Matchers DOM |
| `@testing-library/user-event` | Simulation événements UI |
| `supertest` | Tests d'intégration API |
| `jsdom` | DOM virtuel pour tests |

### 🏗️ Infrastructure & DevOps
| Outil | Usage |
|-------|-------|
| `concurrently` | Dev: client + server en parallèle |
| Cloudflare Tunnel | Exposition HTTPS sans port ouvert |
| Nginx | Reverse proxy + CSP |
| systemd | Process management Linux |

---

## Pourquoi ce projet

Dans un contexte de maintenance d'applications legacy, les modifications manuelles sont lentes et error-prone. CrabCreate transforme un ticket Kanban en code fonctionnel : l'IA (Claude/GPT) analyse la codebase existante, génère les modifications, les pousse sur le dépôt Git, lance une review automatique et déclenche le déploiement — le développeur n'a qu'à valider.

## Ce que j'ai appris

- **Architecture monorepo** client/server TypeScript full-stack
- **Pipelines AI complexes** — prompt engineering, gestion de contexte de code, multi-étapes avec retry/fallback
- **WebSocket temps réel** — synchronisation d'état entre plusieurs clients connectés
- **Sécurité web avancée** — CSRF, JWT httpOnly, rate limiting, CORS, CSP, validation Zod
- **Intégrations API multiples** — Anthropic, OpenAI, Stripe, Bitbucket, Cloudflare Pages, GitHub
- **Testing React** — composants, hooks, intégration API avec mocks
- **Déploiement Linux** — systemd, nginx, Cloudflare Tunnel, gestion de processus

## Architecture

```
┌────────────────────────────────────────┐
│  React 19 + Vite + Tailwind CSS 4     │  ← Client SPA
│  Zustand (state) + Socket.io (RT)     │
│  i18n FR/EN                            │
└──────────────┬─────────────────────────┘
               │ REST + WebSocket
┌──────────────▼─────────────────────────┐
│  Express 5 + SQLite (better-sqlite3)   │  ← Server API
│  Auth: Email OTP → JWT cookie httpOnly │
│  AI: Anthropic SDK + OpenAI SDK        │
│  Job queue pour pipeline async         │
└──────────────┬─────────────────────────┘
               │
    ┌──────────┴──────────────┐
    │  Bitbucket (git push)   │
    │  Cloudflare Pages       │
    │  GitHub (auto-repo)     │
    │  Stripe (billing)       │
    └─────────────────────────┘
```

## Features principales

- **Pipeline AI en 10 étapes** — Du ticket à la production : analyse codebase → génération de code → git push → review automatique → deploy
- **Dashboard Kanban** — Board complet avec drag & drop, filtres, statuts personnalisables
- **Dual AI engine** — Support Anthropic (Claude) et OpenAI (GPT), modèles configurables depuis l'admin
- **51 settings admin** — Configuration granulaire du pipeline, modèles AI, limites, comportements
- **Auth sécurisée** — Email OTP → JWT cookie httpOnly, permissions par rôle
- **Temps réel** — Socket.io pour le suivi live de l'avancement des jobs AI
- **Multi-tenant** — Projets isolés avec gestion des membres et permissions

## Screenshots

![Page d'accueil](https://raw.githubusercontent.com/Maaattqc/CrabCreate/main/docs/screenshot-home.png)

![Dashboard Kanban](https://raw.githubusercontent.com/Maaattqc/CrabCreate/main/docs/screenshot-dashboard.jpg)

![Admin Panel](https://raw.githubusercontent.com/Maaattqc/CrabCreate/main/docs/screenshot-admin.jpg)

## 🤖 Développement assisté par IA

Ce projet a été conçu, architecturé et dirigé par moi — chaque décision technique, structure de données, flow UX et choix de librairie est le résultat de ma réflexion. **Claude Code** a servi d'outil d'exécution : une fois les specs et conventions définies dans `CLAUDE.md`, l'IA a accéléré l'implémentation des patterns répétitifs.

Ce que j'ai défini :
- L'architecture monorepo, le schéma DB, le design du pipeline en 10 étapes
- Les conventions de code, les règles de sécurité, les contrats d'API
- Les choix de stack et l'ensemble des décisions d'architecture

Ce que l'IA a accéléré :
- L'implémentation des composants React selon mes specs
- La génération des tests selon mes conventions de testing
- La rédaction des 8 fichiers de documentation technique
- Le boilerplate répétitif (routes CRUD, types TypeScript, i18n)

## Setup

```bash
git clone https://github.com/Maaattqc/CrabCreate.git
cd CrabCreate
cp .env.example .env
# Remplir les variables d'environnement
npm install
cd server && npm install && cd ..
npm run dev  # Lance client (5173) + server (3000) en parallèle
```

---

## Author

**Mathieu Fournier** · mathieufournierqc@outlook.com — [@Maaattqc](https://github.com/Maaattqc)
