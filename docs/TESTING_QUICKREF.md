# Testing Quick Reference

## Run Tests

```bash
# Watch mode (development)
npm test

# Run once (CI)
npm run test:run

# Visual UI
npm run test:ui

# With coverage
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/              # Unit tests
│   ├── date-utils.test.ts
│   ├── utils.test.ts
│   ├── password.test.ts
│   └── rate-limit.test.ts
└── integration/       # Integration tests
    ├── health.test.ts
    ├── rate-limit.test.ts
    └── security.test.ts
```

## Quick Test

```typescript
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should work', () => {
    const result = myFunction();
    expect(result).toBe(expected);
  });
});
```

## Integration Tests

**Requires app running:**
```bash
# Terminal 1
docker-compose up -d

# Terminal 2
npm test -- tests/integration
```

## Watch Mode Controls

- `a` - Run all tests
- `f` - Run failed tests only
- `p` - Filter by filename
- `t` - Filter by test name
- `q` - Quit

## Common Assertions

```typescript
expect(value).toBe(expected)
expect(value).toEqual(expected)
expect(value).toBeTruthy()
expect(value).toContain(item)
expect(value).toMatch(/regex/)
expect(fn).toThrow('error')
```

## Coverage

```bash
npm run test:coverage
# Open coverage/index.html
```

---

📖 **Full Guide:** See `docs/TESTING.md`
