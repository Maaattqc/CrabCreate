# CrabCreate

[🇫🇷 Lire en français](README.md)

> 🌐 **[View live demo](https://mathieu-fournier.net/crabcreate/)** — deployed on mathieu-fournier.net

> AI-powered Kanban dashboard that automates PHP development — create a ticket, the AI writes the code, pushes to Bitbucket, auto-reviews, and deploys via Jenkins.

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

## Why this project

In a PHP legacy application maintenance context, manual modifications are slow and error-prone. CrabCreate transforms a Kanban ticket into working code: the AI (Claude/GPT) analyzes the existing codebase, generates changes, pushes to Bitbucket, triggers an automatic review, and fires a Jenkins deployment — the developer only needs to validate.

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
│  Async job queue for pipeline          │
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

- **10-step AI pipeline** — From ticket to production: codebase analysis → code generation → git push → auto review → Jenkins deploy
- **Kanban dashboard** — Full board with drag & drop, filters, customizable statuses
- **Dual AI engine** — Supports Anthropic (Claude) and OpenAI (GPT), models configurable from admin panel
- **51 admin settings** — Granular pipeline configuration, AI models, limits, behaviors
- **Secure auth** — Email OTP → httpOnly JWT cookie, role-based permissions
- **Real-time** — Socket.io for live job progress tracking

## Screenshots

![Home page](https://mathieu-fournier.net/crabcreate/docs/screenshot-home.png)

## AI-Assisted Development

Built with **Claude Code** (full `CLAUDE.md` with conventions). AI was used for:
- Full monorepo architecture (client/server)
- 10-step AI pipeline with async job queue management
- 8 technical documentation files in `docs/`
- Vitest + Testing Library tests
- FR/EN internationalization

## Setup

```bash
git clone https://github.com/Maaattqc/CrabCreate.git
cd CrabCreate
cp .env.example .env
# Fill in your environment variables
npm install
npm run dev
```
