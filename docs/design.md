# Design System

## Theme

Dark mode exclusif.

### Couleurs de fond

- `#08080c` — fond principal
- `#0e0e14` — fond secondaire (cards, panels)
- `#121220` — fond tertiaire (hover, subtle)

### Accent

Gradient orange-rouge : `#f59e0b` → `#ef4444` — utilise pour les CTAs, boutons primaires.

### Couleurs par statut (colonnes Kanban)

| Statut | Couleur | Hex |
|--------|---------|-----|
| backlog | Slate | #64748b |
| queued | Orange | #f97316 |
| estimating | Cyan | #06b6d4 |
| ai_coding | Yellow | #eab308 |
| ai_review | Purple | #8b5cf6 |
| testing | Teal | #14b8a6 |
| deploying | Blue | #3b82f6 |
| staging | Sky | #0ea5e9 |
| review | Violet | #a855f7 |
| approved | Green | #22c55e |
| rejected | Red | #ef4444 |

### Priorites

| Priorite | Couleur |
|----------|---------|
| critical | #ef4444 |
| high | #f97316 |
| medium | #eab308 |
| low | #22c55e |

## Typographie

- **Display** : DM Sans (Google Fonts)
- **Code / Mono** : IBM Plex Mono (Google Fonts)

## Composants UI

- **Cards** : Bordures subtiles, hover lift, progress bars colorees par statut
- **Modals** : Backdrop blur, max-width adaptatif, tabs pour les vues
- **Notifications** : Toast top-right, auto-dismiss configurable
- **Skeleton loading** : Variante IA avec grille de points animee

## Fonctionnalites UI

- **Themes** : Clair/Sombre (toggle dans settings)
- **Langue** : FR/EN (i18n complet)
- **Animations** : Toggle on/off
- **AI Design** : Mode design IA avec effets visuels supplementaires (dot grid, skeleton, live activity bar, command palette)
- **Mascotte** : Crabe anime (toggle on/off)
- **Onboarding** : Tour guide premiere connexion

## Pages publiques

- Landing page (`/`)
- Pricing (`/pricing`) — plans dynamiques depuis API
- Contact (`/contact`) — formulaire avec rate limiting
- Legal (`/legal`)
- Privacy (`/privacy`)
- 404 Not Found
