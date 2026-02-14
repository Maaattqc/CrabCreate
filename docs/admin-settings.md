# Settings Admin

Tous les settings sont stockes dans `kanban_config` comme paires cle-valeur texte. 51 cles configurables via l'API `PUT /api/settings` (admin-only, validation Zod).

## Categories

### Limites de debit (Rate Limits)

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `max_requests_per_minute` | 60 | 1 | 1000 | Requetes API /minute |
| `max_tickets_per_hour` | 20 | 1 | 100 | Tickets crees /heure |
| `max_concurrent_pipelines` | 2 | 1 | 10 | Pipelines simultanes |
| `contact_limit` | 3 | 1 | 10 | Messages contact /fenetre |
| `contact_window_minutes` | 60 | 15 | 1440 | Fenetre contact (statique, restart requis) |

### Intelligence Artificielle

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `default_ai_model` | 'claude' | — | — | Modele par defaut (string: claude/gpt) |
| `ai_review_threshold` | 50 | 0 | 100 | Score minimum review |
| `ai_max_tokens` | 8192 | 1024 | 32000 | Tokens max par requete |
| `ai_tokens_complexity` | 500 | 200 | 2000 | Tokens estimation complexite |
| `ai_tokens_chat` | 4096 | 2048 | 16384 | Tokens par message chat |
| `ai_tokens_review` | 2048 | 1024 | 8192 | Tokens pour la review |

### Modeles & Couts IA

| Cle | Defaut | Min | Max | Type | Description |
|-----|--------|-----|-----|------|-------------|
| `ai_model_claude_version` | 'claude-opus-4-6' | — | — | string | Version Claude |
| `ai_model_gpt_version` | 'gpt-5.3' | — | — | string | Version GPT |
| `ai_cost_per_token_claude` | 0.000015 | 0 | 1 | float | Cout/token Claude (USD) |
| `ai_cost_per_token_gpt` | 0.00003 | 0 | 1 | float | Cout/token GPT (USD) |

### Securite

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `dev_login_enabled` | 1 | 0 | 1 | Toggle dev login |
| `registration_enabled` | 1 | 0 | 1 | Toggle inscriptions |
| `session_duration_days` | 30 | 1 | 365 | Duree session JWT (jours) |
| `log_retention_days` | 90 | 7 | 365 | Retention des logs |
| `auth_code_expiry_minutes` | 10 | 5 | 60 | Expiration code OTP |
| `auth_code_limit` | 5 | 3 | 20 | Max codes /fenetre |
| `auth_code_window_minutes` | 15 | 5 | 60 | Fenetre codes (statique) |
| `auth_verify_limit` | 10 | 3 | 30 | Max verifications /fenetre |
| `auth_verify_window_minutes` | 15 | 5 | 60 | Fenetre verif (statique) |

### Pipeline

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `auto_test_enabled` | 1 | 0 | 1 | Toggle auto tests |
| `auto_deploy_enabled` | 1 | 0 | 1 | Toggle auto deploy |
| `queue_polling_interval_ms` | 5000 | 1000 | 30000 | Intervalle polling queue |
| `test_multiplier_per_file` | 3 | 1 | 10 | Multiplicateur tests/fichier |

### Git & Deploiement

| Cle | Defaut | Min | Max | Type | Description |
|-----|--------|-----|-----|------|-------------|
| `git_default_branch` | 'master' | — | — | string | Branche par defaut |
| `git_merge_strategy` | 'merge_commit' | — | — | string | Strategie de merge |
| `git_pr_close_source_branch` | 1 | 0 | 1 | boolean | Fermer branche apres merge |
| `branch_name_max_length` | 30 | 15 | 100 | number | Longueur max nom branche |

### Interface

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `notification_timeout_ms` | 5000 | 2000 | 15000 | Duree notification toast |
| `score_threshold_good` | 70 | 50 | 100 | Seuil score "bon" (vert) |
| `score_threshold_ok` | 50 | 20 | 80 | Seuil score "ok" (jaune) |
| `audit_log_default_limit` | 50 | 10 | 100 | Audit logs par page |
| `audit_log_max_limit` | 200 | 100 | 1000 | Max audit logs |
| `activity_preview_length` | 50 | 20 | 200 | Longueur preview activite |

### Maintenance

| Cle | Defaut | Description |
|-----|--------|-------------|
| `maintenance_mode` | 0 | Active le mode maintenance (bloque les non-admin) |

### Plans (Free / Pro / Enterprise)

| Cle | Defaut | Min | Max | Description |
|-----|--------|-----|-----|-------------|
| `plan_free_tickets` | 5 | 1 | 1000 | Tickets/mois plan Free |
| `plan_free_pipelines` | 1 | 1 | 50 | Pipelines plan Free |
| `plan_pro_tickets` | 50 | 1 | 1000 | Tickets/mois plan Pro |
| `plan_pro_pipelines` | 3 | 1 | 50 | Pipelines plan Pro |
| `plan_enterprise_tickets` | -1 | -1 | 1000 | Tickets/mois Enterprise (-1=illimite) |
| `plan_enterprise_pipelines` | 10 | 1 | 50 | Pipelines plan Enterprise |

## Types de settings

- **NUMERIC_KEYS** : `parseInt()` — entiers
- **BOOLEAN_KEYS** : `parseInt()` clamp 0/1 — toggles
- **STRING_KEYS** : pas de parse — texte libre
- **FLOAT_KEYS** : `parseFloat()` — decimales (couts)

## Notes techniques

- `windowMs` dans express-rate-limit est statique (necessite restart). Seul `limit` est dynamique via `() => parseInt(repo.getConfig(...))`.
- Les settings UI (`notification_timeout_ms`, `score_threshold_*`) sont exposes via `GET /api/app-config` (accessible a tous les users authentifies, pas seulement admin).
- Les plans sont exposes via `GET /api/plans` (public, pour la PricingPage).
