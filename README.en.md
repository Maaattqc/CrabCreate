[🇫🇷 Lire en français](README.md)

# CrabCreate

> 🌐 **[See the live demo](https://mathieu-fournier.net/crabcreate/)** — deployed on mathieu-fournier.net

> Kanban dashboard that automates PHP development — the user creates a ticket, AI codes the changes, pushes to Bitbucket, runs an automatic review, and deploys via Jenkins.

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

## Why This Project

In the context of maintaining legacy PHP applications, manual modifications are slow and error-prone. CrabCreate turns a Kanban ticket into working code: the AI (Claude/GPT) analyzes the existing codebase, generates the changes, pushes them to Bitbucket, triggers an automatic review, and launches deployment via Jenkins — the developer only needs to approve.

## Architecture

```
┌────────────────────────────────────────┐
│  React 19 + Vite 8 + Tailwind CSS 4   │  ← Client SPA
│  Zustand (state) + Socket.io (RT)     │
│  i18n FR/EN                            │
└──────────────┬─────────────────────────┘
               │ REST + WebSocket
┌──────────────▼─────────────────────────┐
│  Express 5 + SQLite (better-sqlite3)   │  ← Server API
│  Auth: Email OTP → JWT cookie httpOnly │
│  AI: Anthropic SDK + OpenAI SDK        │
│  Job queue for async pipeline          │
└──────────────┬─────────────────────────┘
               │
    ┌──────────┴──────────────┐
    │  Bitbucket (git push)   │
    │  Jenkins (deploy)       │
    │  db-docs/ (SQL Server   │
    │   schema injected into  │
    │   AI prompts)           │
    └─────────────────────────┘
```

## Key Features

- **10-step AI pipeline** — From ticket to production: codebase analysis → code generation → git push → automatic review → Jenkins deploy
- **Kanban dashboard** — Full board with drag & drop, filters, customizable statuses
- **Dual AI engine** — Supports Anthropic (Claude) and OpenAI (GPT), models configurable from the admin panel
- **51 admin settings** — Granular pipeline configuration, AI models, limits, behaviors
- **Secure authentication** — Email OTP → JWT httpOnly cookie, role-based permissions
- **Real-time updates** — Socket.io for live tracking of AI job progress

## Screenshots

![Home page](https://mathieu-fournier.net/crabcreate/docs/screenshot-home.png)

## AI-Assisted Development

Project developed with **Claude Code** (complete `CLAUDE.md` file with conventions). AI was used for:
- The complete monorepo architecture (client/server)
- The 10-step AI pipeline with job queue management
- The 8 technical documentation files in `docs/`
- Vitest + Testing Library tests
- FR/EN internationalization
