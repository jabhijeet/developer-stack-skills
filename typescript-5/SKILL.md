# TypeScript 5+ Advanced Features

Advanced TypeScript techniques for full-stack developers: conditional types, generics, utility types, Zod integration, exhaustiveness checking, template literal types, and type-safe patterns.

## Non-Negotiable Rules (CRITICAL)

- **Never** use `any` in TypeScript — always use `unknown` with type guards or define proper types
- **Always** enable `"strict": true` in `tsconfig.json` — treat strict mode warnings as errors
- **Always** use union types over enums — `type Status = "pending" | "active"` is more flexible and tree-shakeable than enums
- **Always** leverage Zod for runtime validation — TypeScript types only exist at compile time; Zod validates at runtime
- **Always** use exhaustiveness checking to ensure all cases in discriminated unions are handled
- **Always** use generic constraints over `any` — use `<T extends Something>` to maintain type safety
- **Always** document complex types — use JSDoc for generic utilities and mapped types
- **Never** use `// @ts-ignore` to bypass TypeScript compiler — fix the root cause; `@ts-ignore` hides real bugs
- **Never** trust client-sent types — always validate with Zod or similar on the server
- Type safety is not optional — strict mode violations are defects, not style preferences

## Quick Reference

### Conditional Types

```typescript
type IsArray<T> = T extends unknown[] ? true : false;
type IsTuple<T> = T extends readonly [infer First, ...infer Rest] ? true : false;

// Extract return type
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
```

### Generics & Constraints

```typescript
// Generic constraints
interface HasName {
  name: string;
}

function getName<T extends HasName>(obj: T): string {
  return obj.name;
}

// Default generic types
type Container<T = unknown> = { value: T };

// Multiple bounds with intersection
type KeyOf<T extends object> = keyof T;
```

### Utility Types

```typescript
// Omit, Pick, Record, Extract, Exclude
type User = { id: number; name: string; email: string };
type UserPreview = Pick<User, "id" | "name">;
type UserWithoutEmail = Omit<User, "email">;
type Admin = User & { role: "admin" };
```

### Template Literal Types

```typescript
type CSSUnit = "px" | "rem" | "em" | "vh" | "vw";
type CSSValue = `${number}${CSSUnit}`;

type EventName = `on${Capitalize<"click" | "change" | "focus">}`;
// Results in: "onClick" | "onChange" | "onFocus"
```

### Zod Integration for Runtime Validation

```typescript
import { z } from "zod";

const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  email: z.string().email(),
  createdAt: z.date(),
});

type User = z.infer<typeof UserSchema>;

// Validation
const result = UserSchema.safeParse(data);
if (!result.success) {
  console.error(result.error.format());
} else {
  const validUser: User = result.data;
}
```

### Exhaustiveness Checking

```typescript
type Status = "pending" | "active" | "completed" | "failed";

function handleStatus(status: Status): void {
  switch (status) {
    case "pending":
      console.log("Waiting...");
      break;
    case "active":
      console.log("Processing...");
      break;
    case "completed":
      console.log("Done!");
      break;
    case "failed":
      console.log("Error occurred");
      break;
    default:
      const _exhaustiveCheck: never = status;
      throw new Error(`Unhandled status: ${_exhaustiveCheck}`);
  }
}
```

### Generic Composition

```typescript
// Compose multiple generic constraints
type Serializable = {
  serialize(): string;
};

type Identifiable = {
  id: string;
};

function processEntity<T extends Serializable & Identifiable>(
  entity: T
): { id: string; data: string } {
  return {
    id: entity.id,
    data: entity.serialize(),
  };
}
```

### Mapped Types

```typescript
// Create read-only version
type ReadOnly<T> = {
  readonly [K in keyof T]: T[K];
};

// Make all properties optional
type Partial<T> = {
  [K in keyof T]?: T[K];
};

// Getters for all properties
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};
```

### Advanced Pattern: Type-Safe Builder

```typescript
interface Builder<T> {
  build(): T;
}

type BuilderMethod<T, K extends keyof T> = (value: T[K]) => Builder<T>;

type ObjectBuilder<T> = {
  [K in keyof T]: BuilderMethod<T, K>;
} & Builder<T>;

function createBuilder<T>(initial: Partial<T>): ObjectBuilder<T> {
  const obj = { ...initial };
  
  const handler = {
    build: () => obj,
    ...Object.fromEntries(
      Object.keys(initial).map(key => [
        key,
        (value: any) => createBuilder({ ...obj, [key]: value })
      ])
    )
  };
  
  return handler as ObjectBuilder<T>;
}
```

## Best Practices

1. **Prefer type inference** — Let TypeScript infer types when possible to reduce boilerplate
2. **Use union types over enums** — `type Status = "pending" | "active"` is more flexible
3. **Leverage Zod for runtime validation** — TypeScript types only exist at compile time
4. **Enable strict mode** — Use `"strict": true` in `tsconfig.json`
5. **Use exhaustiveness checking** — Ensure all cases in discriminated unions are handled
6. **Generic constraints over any** — Use `<T extends Something>` to maintain type safety
7. **Document complex types** — Use JSDoc for generic utilities and mapped types

## Common Patterns

### Tagged Unions (Discriminated Unions)

```typescript
type Result<T, E> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

function processResult<T, E>(result: Result<T, E>): T | E {
  if (result.ok) {
    return result.value;
  } else {
    return result.error;
  }
}
```

### Type Guards

```typescript
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUser(value: unknown): value is User {
  return value instanceof Object && "id" in value && "name" in value;
}
```

### Namespace Pattern (Module Augmentation)

```typescript
declare global {
  interface Array<T> {
    groupBy<K>(keyFn: (item: T) => K): Map<K, T[]>;
  }
}

Array.prototype.groupBy = function<T, K>(keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of this) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return map;
};
```

## Testing TypeScript Code

Use Vitest with TypeScript:

```typescript
import { describe, it, expect } from "vitest";

describe("TypeScript Types", () => {
  it("should satisfy type constraints", () => {
    type Test = 5 extends number ? true : false;
    expect(true).toBe(true);
  });

  it("validates Zod schemas", () => {
    const schema = z.number();
    expect(schema.safeParse(42).success).toBe(true);
    expect(schema.safeParse("not a number").success).toBe(false);
  });
});
```

## Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

## Further Reading

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Zod Documentation](https://zod.dev/)
- [TypeScript Cheat Sheets](https://github.com/typescript-cheatsheets/react)

