# Tests

## Setup

Les deux projets utilisent **Vitest**. Le client utilise en plus `@testing-library/react` et `@testing-library/user-event`.

## Commandes

```bash
# Client
cd client && npm test           # vitest run (une fois)
cd client && npm run test:watch # vitest (watch mode)

# Server
cd server && npm test           # vitest run
cd server && npm run test:watch # vitest (watch mode)
```

## Emplacement des tests

- **Client** : `client/src/tests/*.test.ts` / `*.test.tsx`
- **Server** : `server/tests/*.test.ts`

## Conventions

### Regle principale

**Tout nouveau code testable doit avoir des tests.** Cela inclut :
- Nouveaux hooks → test unitaire avec `renderHook`
- Nouveaux composants → test de rendu avec `@testing-library/react`
- Nouvelles routes API → test d'integration
- Nouvelles fonctions utilitaires → test unitaire
- Nouvelles validations Zod → test des cas valides et invalides

### Structure d'un test

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('NomDuModule', () => {
  it('decrit le comportement attendu', () => {
    // Arrange → Act → Assert
  });
});
```

### Tests de hooks

```typescript
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useMyHook());
act(() => { result.current.doSomething(); });
expect(result.current.value).toBe(expected);
```

### Tests de composants

```typescript
import { render, screen, fireEvent } from '@testing-library/react';

render(<MyComponent prop="value" />);
expect(screen.getByText('Expected text')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button'));
```

### Mocks

- `vi.fn()` pour les fonctions mock
- `vi.useFakeTimers()` pour les timers (setTimeout, setInterval)
- `vi.mock()` pour mocker des modules entiers

## Tests existants (client)

| Fichier | Quoi |
|---------|------|
| `useNotifications.test.ts` | Hook notifications (add, remove, auto-dismiss) |
| `useAuth.test.tsx` | Hook auth (login, logout, me) |
| `useTheme.test.tsx` | Hook theme (toggle, localStorage) |
| `useLanguage.test.tsx` | Hook langue (FR/EN, toggle) |
| `useAnimations.test.tsx` | Hook animations (toggle) |
| `useAIDesign.test.tsx` | Hook AI design (toggle) |
| `api.test.ts` | Appels API REST (fetch mock) |
| `constants.test.ts` | Constantes (COLUMNS, couleurs) |
| `i18n.test.ts` | Traductions (cles FR/EN) |
| `components.test.tsx` | Composants UI (NotificationToast) |
| `skeletonBoard.test.tsx` | SkeletonBoard rendu |
| `onboarding.test.tsx` | Onboarding flow |
| `routing.test.tsx` | Routes React Router |
