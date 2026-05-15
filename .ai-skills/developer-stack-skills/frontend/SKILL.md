---
name: frontend
description: >
  Use this skill for any frontend development task. Covers React and Angular application
  structure, TypeScript conventions, component design, state management, API integration,
  routing, and JavaScript best practices. Trigger when the user asks to create, review,
  debug, or refactor UI components, pages, hooks, services, or frontend architecture
  in React, Angular, or plain JavaScript/TypeScript projects.
compatibility: Roocode, Cline, GitHub Copilot, Claude, Cursor, any LLM-based coding agent
version: 1.0.0
last-reviewed: 2026-05-15
applies-to: React, Angular, JavaScript, TypeScript, frontend architecture, UI refactors
---

# Frontend Skill (React · Angular · JavaScript/TypeScript)

## When to Use This Skill

Load this skill whenever the task involves:
- Creating or modifying React or Angular components
- Structuring frontend projects and folder layouts
- State management (Redux, Zustand, NgRx, signals)
- API integration and data fetching patterns
- TypeScript types and interfaces
- Routing (React Router, Angular Router)
- Form handling and validation
- Performance optimization (memoization, lazy loading)
- Reviewing or refactoring existing frontend code

## Priority Order

1. Follow existing repo structure, tooling, and lint/test rules first
2. Use this skill's defaults only when repo does not already establish pattern
3. If repo conventions and this skill conflict, prefer repo conventions and note mismatch

## Output Contract

- State assumptions when repo context is missing
- List files changed when making edits
- Add or update tests for behavior changes
- Avoid unrelated refactors unless they are required to complete task safely
- Call out blockers, risks, and follow-up work explicitly

## Conflict Resolution

Use this precedence order when instructions conflict:
1. Existing repo code and enforced automation
2. Repo docs and local agent instructions
3. Loaded `project-conventions/SKILL.md`
4. This stack skill
5. Generic framework best practices

---

## TypeScript — Non-Negotiable Defaults

- Use TypeScript for all projects; JavaScript is only acceptable for quick scripts
- Enable strict mode in `tsconfig.json`: `"strict": true`
- Never use `any` — use `unknown` and narrow it, or define a proper type
- Prefer `interface` for object shapes, `type` for unions/intersections/aliases
- Always type function parameters and return values explicitly

```typescript
// Bad
const getUser = (id) => fetch(`/api/users/${id}`).then(r => r.json());

// Good
async function getUser(id: number): Promise<UserResponse> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<UserResponse>;
}
```

---

## React

### Project Structure
```
src/
├── app/                      # App-level setup (providers, router, global styles)
├── features/                 # Feature-based modules
│   └── users/
│       ├── components/       # Feature-specific components
│       ├── hooks/            # Feature-specific custom hooks
│       ├── services/         # API calls for this feature
│       ├── store/            # State (Redux slice / Zustand store)
│       └── types.ts          # Types scoped to this feature
├── components/               # Truly shared/generic UI components
├── hooks/                    # Shared custom hooks
├── lib/                      # Utility functions, API client setup
├── types/                    # Global shared types
└── main.tsx
```

### Component Rules
- Use **functional components** exclusively — no class components
- One component per file; filename matches component name (PascalCase)
- Keep components under ~150 lines — split when they grow larger
- Extract logic into custom hooks; keep JSX presentational

```tsx
// Good: thin component, logic in hook
interface UserCardProps {
  userId: number;
}

export function UserCard({ userId }: UserCardProps) {
  const { user, isLoading, error } = useUser(userId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage message={error.message} />;
  if (!user) return null;

  return (
    <div className="user-card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

### Custom Hooks
- Prefix with `use`: `useUser`, `useAuth`, `useDebounce`
- Encapsulate data fetching, side effects, and derived state

```typescript
export function useUser(userId: number) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getUser(userId)
      .then((data) => { if (!cancelled) setUser(data); })
      .catch((err) => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return { user, isLoading, error };
}
```

> For new projects, prefer **TanStack Query** (`@tanstack/react-query`) over manual `useEffect` — it handles caching, deduplication, and refetching out of the box.

### State Management Guidelines
| Scope             | Recommended Tool               |
|-------------------|--------------------------------|
| Server/async state| TanStack Query                 |
| Local component   | `useState` / `useReducer`      |
| Shared UI state   | Zustand (simple) / Redux Toolkit (complex) |
| Form state        | React Hook Form                |

### Performance Rules
- Default to plain readable React code first
- Add `useMemo`, `useCallback`, or `React.memo` only when profiling, rerender pressure, or stable prop identity makes benefit clear
- Use `React.lazy` + `Suspense` for route-level code splitting
- Avoid unnecessary inline objects/arrays when they create unstable prop identity in hot paths

---

## Angular

### Project Structure
```
src/app/
├── core/                     # Singleton services, guards, interceptors
│   ├── interceptors/
│   ├── guards/
│   └── services/
├── shared/                   # Shared components, pipes, directives
│   ├── components/
│   ├── pipes/
│   └── directives/
├── features/                 # Lazy-loaded feature modules
│   └── users/
│       ├── components/
│       ├── services/
│       ├── store/
│       └── users.routes.ts
└── app.routes.ts
```

### Component Rules
- Use **standalone components** (Angular 17+) by default
- Use `OnPush` change detection for all components
- Use **signals** (`signal`, `computed`, `effect`) for reactive state

```typescript
@Component({
  selector: 'app-user-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (user(); as u) {
      <div class="user-card">
        <h2>{{ u.name }}</h2>
        <p>{{ u.email }}</p>
      </div>
    }
  `,
})
export class UserCardComponent {
  userId = input.required<number>();
  private userService = inject(UserService);
  user = toSignal(
    toObservable(this.userId).pipe(switchMap(id => this.userService.getUser(id)))
  );
}
```

### Service Rules
- Use `inject()` function (not constructor injection) for Angular 14+
- Provide at root: `providedIn: 'root'`
- Return `Observable` from service methods; never subscribe inside services

```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  getUser(id: number): Observable<UserResponse> {
    return this.http.get<UserResponse>(`/api/v1/users/${id}`);
  }

  createUser(payload: UserCreate): Observable<UserResponse> {
    return this.http.post<UserResponse>('/api/v1/users', payload);
  }
}
```

### State Management Guidelines
| Scope             | Recommended Tool           |
|-------------------|----------------------------|
| Component-local   | Signals                    |
| Feature-wide      | NgRx Component Store / Signals Store |
| App-wide complex  | NgRx Store                 |
| Form state        | Reactive Forms             |

---

## JavaScript / TypeScript General Rules

### Naming Conventions
| Element           | Convention        | Example                     |
|-------------------|-------------------|-----------------------------|
| Variables/funcs   | camelCase         | `getUserById`               |
| Classes/types     | PascalCase        | `UserService`, `UserResponse` |
| Constants         | UPPER_SNAKE_CASE  | `MAX_RETRY_COUNT`           |
| React component files | PascalCase   | `UserCard.tsx`              |
| Angular files     | kebab-case        | `user-card.component.ts`    |
| CSS classes       | kebab-case        | `user-card`, `btn-primary`  |

### Async/Await
- Always use `async/await` over `.then()` chains
- Always handle errors with `try/catch` or `.catch()`
- Use `Promise.all()` for concurrent independent operations

```typescript
// Bad — sequential when they could be parallel
const user = await getUser(id);
const settings = await getSettings(id);

// Good — parallel
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]);
```

### Null Safety
- Use optional chaining: `user?.address?.city`
- Use nullish coalescing: `user?.name ?? "Anonymous"`
- Never use non-null assertion (`!`) without a comment justifying it

---

## API Integration Pattern

Centralize all API calls; never call `fetch` directly inside components.

```typescript
// lib/apiClient.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)               => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: "POST",   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: "PUT",    body: JSON.stringify(body) }),
  delete: <T>(path: string)               => request<T>(path, { method: "DELETE" }),
};
```

---

## Non-Negotiable Rules

- **Never** use `any` in TypeScript — define proper types
- **Never** fetch data directly inside components — use hooks or services
- **Never** mutate React state directly (`state.items.push(x)` is wrong)
- **Never** subscribe and forget in Angular — always use `async` pipe or unsubscribe
- **Always** handle loading and error states in UI — never assume success
- **Always** use environment variables for API base URLs and config
- **Always** lazy-load routes to keep initial bundle small
- Write accessible markup: semantic HTML, ARIA labels, keyboard navigability

---

## VSCode / IntelliJ Tips

- **VSCode**: Install **ESLint**, **Prettier**, **Angular Language Service** or **ES7+ React Snippets**
- **IntelliJ**: Enable **TypeScript Service** under Languages & Frameworks → TypeScript
- Enable `"editor.formatOnSave": true` with Prettier as the formatter
- Use **path aliases** (`@/` → `src/`) in `tsconfig.json` for cleaner imports
- Use **REST Client** extension (`.http` files) for in-editor API testing
