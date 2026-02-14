# API REST

Toutes les routes sont prefixees par `/api`. Le rate limiter global s'applique a toutes.

## Routes publiques (pas de JWT requis)

### Auth (`/api/auth`)

```
POST /api/auth/request-code     Demande un code OTP par email
POST /api/auth/verify-code      Verifie le code → JWT cookie
POST /api/auth/dev-login        Login admin dev (NODE_ENV != production)
POST /api/auth/dev-login-client Login client dev
POST /api/auth/logout           Supprime le cookie JWT
GET  /api/auth/me               User courant (depuis cookie)
PUT  /api/auth/preferences      Maj preferences user (lang, theme, etc.)
```

### Contact (`/api/contact`)

```
POST /api/contact               Envoyer un message contact (rate limited)
```

### Webhooks (`/api/webhooks`)

```
POST /api/webhooks/bitbucket    Webhook Bitbucket (pipeline status)
```

### Plans (`/api/plans`)

```
GET  /api/plans                 Config plans (Free/Pro/Enterprise) pour PricingPage
```

## Routes protegees (JWT requis)

### App config (`/api/app-config`)

```
GET  /api/app-config            Config UI (notification_timeout, score thresholds)
```

*Note : avant le maintenanceGuard, accessible meme en maintenance.*

### Tickets (`/api/tickets`)

```
GET    /api/tickets             Liste tous les tickets (filtres query params)
GET    /api/tickets/:id         Detail d'un ticket
POST   /api/tickets             Creer un ticket
PUT    /api/tickets/:id         Modifier un ticket
DELETE /api/tickets/:id         Supprimer un ticket
```

### Pipeline (`/api/pipeline`)

```
POST /api/pipeline/launch/:id   Lancer le pipeline AI complet
POST /api/pipeline/approve/:id  Approuver (merge PR)
POST /api/pipeline/reject/:id   Rejeter (close PR)
POST /api/pipeline/retry/:id    Retry (remettre en backlog)
POST /api/pipeline/rollback/:id Rollback un ticket approved
```

### Logs, Chat, Activity, Diff

```
GET  /api/tickets/:id/logs      Logs d'un ticket
GET  /api/tickets/:id/chat      Messages chat d'un ticket
POST /api/tickets/:id/chat      Envoyer un message chat
GET  /api/tickets/:id/activity  Historique d'activite
GET  /api/tickets/:id/diff      Diff du code modifie
```

### Analytics (`/api/analytics`)

```
GET  /api/analytics             Stats agregees (tokens, couts, lignes, scores)
```

### Prompts (`/api/prompts`)

```
GET  /api/prompts               Lire le system prompt actuel
PUT  /api/prompts               Sauvegarder le system prompt
```

### Autres

```
GET  /api/file-locks            Fichiers actuellement lockes
GET  /api/repos                 Repos configures
```

## Routes admin (JWT + is_admin=1)

### Settings (`/api/settings`)

```
GET  /api/settings              Lire tous les settings (51 cles)
PUT  /api/settings              Modifier des settings (validation Zod)
```

### Admin (`/api/admin`)

```
GET    /api/admin/users         Liste des utilisateurs
PUT    /api/admin/users/:id     Modifier un user (plan, admin, blocked)
DELETE /api/admin/users/:id     Supprimer un user
GET    /api/admin/audit-logs    Journal d'audit (pagination)
```

## Socket.io Events

Direction server → client uniquement. Le client utilise REST pour les mutations.

```
ticket:log      { ticketId, message, logType, phase }
ticket:status   { ticketId, status, progress }
ticket:updated  { ticketId, ...fields }
notification    { message, type }
```
