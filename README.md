# CrabCreate

> Dashboard Kanban qui automatise le développement PHP — l'utilisateur crée un ticket, l'IA code les modifications, push sur Bitbucket, review automatique, deploy via Jenkins.

![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat&logo=sqlite&logoColor=white)

## Pourquoi ce projet

Dans un contexte de maintenance d'applications PHP legacy, les modifications manuelles sont lentes et error-prone. CrabCreate transforme un ticket Kanban en code fonctionnel : l'IA (Claude/GPT) analyse la codebase existante, génère les modifications, les pousse sur Bitbucket, lance une review automatique et déclenche le déploiement via Jenkins — le développeur n'a qu'à valider.

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
│  Job queue pour pipeline async         │
└──────────────┬─────────────────────────┘
               │
    ┌──────────┴──────────────┐
    │  Bitbucket (git push)   │
    │  Jenkins (deploy)       │
    │  db-docs/ (SQL Server   │
    │   schema injecté dans   │
    │   les prompts AI)       │
    └─────────────────────────┘
```

## Features principales

- **Pipeline AI en 10 étapes** — Du ticket à la production : analyse codebase → génération de code → git push → review automatique → deploy Jenkins
- **Dashboard Kanban** — Board complet avec drag & drop, filtres, statuts personnalisables
- **Dual AI engine** — Support Anthropic (Claude) et OpenAI (GPT), modèles configurables depuis l'admin
- **51 settings admin** — Configuration granulaire du pipeline, modèles AI, limites, comportements
- **Auth sécurisée** — Email OTP → JWT cookie httpOnly, permissions par rôle
- **Temps réel** — Socket.io pour le suivi live de l'avancement des jobs AI

## AI-Assisted Development

Projet développé avec **Claude Code** (fichier `CLAUDE.md` complet avec conventions). L'AI a été utilisée pour :
- L'architecture complète du monorepo (client/server)
- Le pipeline AI en 10 étapes avec gestion de la job queue
- Les 8 fichiers de documentation technique dans `docs/`
- Les tests Vitest + Testing Library
- L'internationalisation FR/EN

