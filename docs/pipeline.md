# Pipeline IA

Flow sequentiel declenche quand l'utilisateur clique "Launch" sur un ticket.

## Etapes

### 1. Dependency Check (`dependency-checker.ts`)
- Verifie que tous les tickets dans `depends_on` sont au statut `approved`
- Si non → statut `queued`, log "En attente de #X"

### 2. File Lock Check (`file-locker.ts`)
- Verifie que les fichiers cibles ne sont pas lockes par un autre ticket
- Si lockes → statut `queued`, log "Fichiers bloques par #X"
- Si OK → INSERT les locks dans `kanban_file_locks`

### 3. Estimation de complexite (`ai-coder.ts`) — statut `estimating`
- Appelle l'IA avec la description du ticket
- Prompt : "Analyse cette tache et estime sa complexite : easy/medium/hard"
- Modele et tokens configurables (`ai_model_*_version`, `ai_tokens_complexity`)
- Met a jour le champ `complexity`
- Stream les logs via Socket.io

### 4. AI Coding (`ai-coder.ts`) — statut `ai_coding`
- `repo-reader.ts` clone ou pull le repo Bitbucket (dossier temp par ticket)
- Lit les fichiers cibles listes dans `target_files`
- Lit le dossier `db-docs/` pour le contexte DB SQL Server
- Construit le prompt avec : system prompt + template prefix + ticket + DB context + code existant
- Parse la reponse JSON (`files[]` + `summary`)
- Ecrit les fichiers modifies dans le clone local
- Calcule `lines_added`, `lines_removed` via diff
- Calcule le cout en USD (`ai_cost_per_token_*` configurable)
- Nom de branche limite a `branch_name_max_length` (configurable)
- Stream chaque etape via Socket.io

### 5. AI Code Review (`ai-reviewer.ts`) — statut `ai_review`
- 2e appel IA avec le diff genere
- Prompt : "Review this code diff for quality, security, performance. Score 0-100."
- Tokens configurables (`ai_tokens_review`)
- Stocke score + issues dans `ai_review_data`
- Si score < seuil (`ai_review_threshold`, defaut 50) → auto-reject, retour en backlog

### 6. Auto Tests (`test-generator.ts`) — statut `testing`
- Appel IA pour generer des tests PHPUnit
- Multiplicateur configurable (`test_multiplier_per_file`)
- Resultats dans `test_results`
- Si tests failed → log warning
- Peut etre desactive (`auto_test_enabled`)

### 7. Deploy to Staging (`deployer.ts` + `bitbucket.ts`) — statut `deploying` puis `staging`
- `simple-git` : commit + push branche sur Bitbucket
- `bitbucket.ts` : cree une Pull Request via API REST
- Options configurables : `git_default_branch`, `git_merge_strategy`, `git_pr_close_source_branch`
- Genere une `staging_url`
- Statut → `review`
- Peut etre desactive (`auto_deploy_enabled`)

### 8. Human Review — statut `review`
- L'utilisateur voit : diff, AI review score, test results, staging URL, chat
- **Approve** → merge PR → Bitbucket webhook → Jenkins → deploy prod
- **Reject** → close PR, libere les file locks, statut → `rejected`

### 9. Chat corrections
- L'utilisateur envoie un message dans le chat du ticket
- Backend appelle l'IA avec contexte (code actuel + historique chat + nouvelle instruction)
- L'IA modifie le code, re-push sur la meme branche
- Tokens chat configurables (`ai_tokens_chat`)

### 10. Rollback
- Sur un ticket `approved`, clic "Rollback"
- `bitbucket.ts` cree un revert commit sur la branche par defaut
- Jenkins auto-deploy le revert

## Job Queue (`queue.ts`)

Queue basee sur SQLite. Polling configurable (`queue_polling_interval_ms`, defaut 5000ms). Les tickets au statut `queued` sont automatiquement lances quand leurs dependances et file locks sont resolus. Concurrence limitee par `max_concurrent_pipelines`.

## Contexte db-docs

Le dossier `db-docs/` contient la documentation du schema SQL Server du site PHP existant (tables, colonnes, relations, stored procedures). `db-docs-reader.ts` concatene tous les fichiers et les injecte dans le prompt IA pour que l'IA comprenne la structure de la DB quand elle genere du code PHP. Ce dossier est gitignore (donnees sensibles).
