# Base de donnees

## SQLite

Package : `better-sqlite3` (synchrone, pas d'async).
Fichier : `server/db/kanban.db` (cree automatiquement au premier lancement).
Migrations : `server/db/migrations.ts` — executees au demarrage.

## Tables

### kanban_tickets

Tickets principaux du Kanban.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| title | TEXT NOT NULL | | Titre du ticket |
| description | TEXT | | Description detaillee |
| priority | TEXT | 'medium' | critical, high, medium, low |
| status | TEXT | 'backlog' | Voir [statuts](#statuts) |
| template | TEXT | 'feature' | feature, bugfix, refactor, ui, perf, security |
| ai_model | TEXT | 'claude' | claude, gpt |
| repo | TEXT | 'main-site' | Reference vers kanban_repos.id |
| assignee | TEXT | 'unassigned' | Membre assigne |
| complexity | TEXT | 'unknown' | easy, medium, hard, unknown |
| target_files | TEXT | | JSON array de chemins fichiers |
| tags | TEXT | | JSON array de tags |
| depends_on | TEXT | | JSON array d'IDs tickets |
| branch_name | TEXT | | Nom de branche git |
| pr_url | TEXT | | URL de la Pull Request |
| pr_id | INTEGER | | ID de la PR Bitbucket |
| staging_url | TEXT | | URL preview staging |
| lines_added | INTEGER | 0 | Lignes ajoutees |
| lines_removed | INTEGER | 0 | Lignes supprimees |
| tokens_used | INTEGER | 0 | Tokens IA consommes |
| cost_usd | REAL | 0 | Cout en USD |
| ai_review_score | INTEGER | | Score review /100 |
| ai_review_data | TEXT | | JSON issues de review |
| test_results | TEXT | | JSON resultats tests |
| progress | INTEGER | 0 | Progression 0-100 |
| user_id | INTEGER | | Auteur (FK auth_users) |
| created_at | TEXT | datetime('now') | |
| updated_at | TEXT | datetime('now') | |

### kanban_logs

Logs temps reel streames via Socket.io pendant le pipeline.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| ticket_id | INTEGER FK | | kanban_tickets(id) CASCADE |
| message | TEXT | | Contenu du log |
| log_type | TEXT | 'info' | info, success, error, warning |
| phase | TEXT | | estimating, coding, reviewing, testing, deploying |
| created_at | TEXT | datetime('now') | |

### kanban_chat

Messages de conversation avec l'IA par ticket.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| ticket_id | INTEGER FK | | kanban_tickets(id) CASCADE |
| role | TEXT NOT NULL | | user, ai |
| message | TEXT NOT NULL | | Contenu du message |
| created_at | TEXT | datetime('now') | |

### kanban_activity

Timeline d'historique par ticket.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| ticket_id | INTEGER FK | | kanban_tickets(id) CASCADE |
| message | TEXT | | Description de l'action |
| activity_type | TEXT | | create, estimate, ai, ai_review, test, push, pr, staging, deploy, approve, reject, retry, rollback, chat, queue |
| created_at | TEXT | datetime('now') | |

### kanban_file_locks

Verrouillage de fichiers entre tickets concurrents.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| file_path | TEXT NOT NULL | | Chemin du fichier locke |
| ticket_id | INTEGER FK | | kanban_tickets(id) CASCADE |
| locked_at | TEXT | datetime('now') | |

### kanban_config

Configuration cle-valeur. Stocke le system prompt, tous les settings admin (~51 cles).

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| config_key | TEXT PK | | Cle unique |
| config_value | TEXT | | Valeur (toujours texte) |
| updated_at | TEXT | datetime('now') | |

### kanban_repos

Repos Bitbucket configures.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | TEXT PK | | Identifiant (ex: 'main-site') |
| label | TEXT | | Nom affiche |
| bitbucket_workspace | TEXT | | Workspace Bitbucket |
| bitbucket_repo_slug | TEXT | | Slug du repo |
| default_branch | TEXT | 'master' | Branche par defaut |
| local_path | TEXT | | Chemin du clone local |
| created_at | TEXT | datetime('now') | |

### auth_users

Utilisateurs authentifies.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| email | TEXT NOT NULL UNIQUE | | |
| is_admin | INTEGER | 0 | 1 = admin |
| plan | TEXT | 'free' | free, pro, enterprise |
| blocked | INTEGER | 0 | 1 = bloque |
| blocked_reason | TEXT | | Motif du blocage |
| preferences | TEXT | '{}' | JSON (lang, theme, animations, etc.) |
| created_at | TEXT | datetime('now') | |
| last_login_at | TEXT | | |

### auth_codes

Codes OTP pour l'authentification email.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| email | TEXT NOT NULL | | |
| code | TEXT NOT NULL | | Code 6 chiffres |
| expires_at | TEXT NOT NULL | | Date d'expiration |
| used | INTEGER | 0 | 1 = utilise |
| attempts | INTEGER | 0 | Tentatives de verification |
| created_at | TEXT | datetime('now') | |

### kanban_contact_messages

Messages du formulaire de contact public.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| name | TEXT NOT NULL | | Nom |
| email | TEXT NOT NULL | | Email |
| message | TEXT NOT NULL | | Message |
| ip | TEXT | | Adresse IP |
| created_at | TEXT | datetime('now') | |

### kanban_audit_logs

Journal d'audit des actions admin.

| Colonne | Type | Default | Description |
|---------|------|---------|-------------|
| id | INTEGER PK | AUTO | |
| user_id | INTEGER | | |
| user_email | TEXT | | |
| action | TEXT NOT NULL | | login, dev_login, settings_update, etc. |
| entity_type | TEXT | | user, settings, ticket |
| entity_id | INTEGER | | |
| details | TEXT | | Description de l'action |
| ip | TEXT | | Adresse IP |
| created_at | TEXT | datetime('now') | |

## Statuts

Ordre du pipeline : `backlog` → `queued` → `estimating` → `ai_coding` → `ai_review` → `testing` → `deploying` → `staging` → `review` → `approved` / `rejected`

## Donnees d'init (seeds)

- System prompt par defaut dans `kanban_config` (cle: `system_prompt`)
- Repo par defaut `main-site` dans `kanban_repos`
- Admin seed depuis la variable `ADMIN_EMAIL` du `.env`

## Migrations colonnes

Les migrations ajoutent les colonnes manquantes sur les DBs existantes :
- `kanban_tickets.user_id`
- `auth_users.is_admin`, `.preferences`, `.plan`, `.blocked`, `.blocked_reason`
