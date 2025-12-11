# Testing Guide - mobiFaktura

This document describes the testing setup and how to run tests for the mobiFaktura application.

## Overview

The application uses **Vitest** for testing - a fast, modern testing framework that works seamlessly with TypeScript and supports ES modules.

### Test Structure

```
tests/
├── setup.ts                  # Global test configuration
├── unit/                     # Unit tests
│   ├── date-utils.test.ts   # Date formatting utilities
│   ├── utils.test.ts        # General utilities (cn, etc.)
│   ├── password.test.ts     # Password validation
│   └── rate-limit.test.ts   # Rate limiting logic
└── integration/              # Integration tests
    ├── health.test.ts       # Health check endpoint
    ├── rate-limit.test.ts   # Rate limiting behavior
    └── security.test.ts     # Security headers & config
```

## Running Tests

### Basic Commands

```bash
# Run all tests in watch mode
npm test

# Run all tests once
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Watch Mode (Development)

```bash
npm test
```

Watch mode automatically reruns tests when you change files:
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `p` to filter by filename
- Press `t` to filter by test name
- Press `q` to quit

### UI Mode (Visual Testing)

```bash
npm run test:ui
```

Opens a web interface at `http://localhost:51204` where you can:
- See all tests in a tree view
- View test results and errors
- Filter and search tests
- See code coverage visually

## Test Categories

### Unit Tests

Test individual functions and utilities in isolation.

**Examples:**
- `date-utils.test.ts` - Date formatting functions
- `utils.test.ts` - Class name merging (cn)
- `password.test.ts` - Password validation rules
- `rate-limit.test.ts` - Rate limiting logic

**Run only unit tests:**
```bash
npm test -- tests/unit
```

### Integration Tests

Test API endpoints and system behavior.

**Examples:**
- `health.test.ts` - Health check endpoint
- `rate-limit.test.ts` - Rate limiting on actual endpoints
- `security.test.ts` - Security headers and configuration

**Run only integration tests:**
```bash
npm test -- tests/integration
```

**Note:** Integration tests require the app to be running:
```bash
# In terminal 1
docker-compose up -d

# In terminal 2
npm run test:run -- tests/integration
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { formatDate } from '@/lib/date-utils';

describe('formatDate', () => {
  it('should format date correctly', () => {
    const date = new Date('2025-12-11');
    const result = formatDate(date);
    
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('Health Check API', () => {
  const BASE_URL = 'http://localhost:3000';

  it('should return 200 status', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    
    expect(response.status).toBe(200);
  });
});
```

### Test Hooks

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('My Tests', () => {
  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });

  it('test 1', () => {
    // Test code
  });
});
```

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

Coverage reports are generated in:
- `coverage/` directory
- Open `coverage/index.html` in browser for visual report

### Coverage Goals

| Type | Target |
|------|--------|
| Statements | > 70% |
| Branches | > 60% |
| Functions | > 70% |
| Lines | > 70% |

### View Coverage

```bash
# Generate and open coverage report
npm run test:coverage
# Then open coverage/index.html in browser
```

## Continuous Integration

### Pre-commit Hook (Optional)

Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run test:run
```

### CI Pipeline (GitHub Actions)

Create `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

## Test Configuration

### Vitest Config (`vitest.config.ts`)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Setup File (`tests/setup.ts`)

Global configuration that runs before all tests:
- Sets test environment variables
- Configures mocks
- Sets up global test utilities

## Best Practices

### 1. Test Naming

```typescript
// ❌ Bad
it('test 1', () => { ... });

// ✅ Good
it('should format date in DD.MM.YYYY format', () => { ... });
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should validate strong passwords', () => {
  // Arrange
  const password = 'StrongP@ss123';
  
  // Act
  const result = validatePassword(password);
  
  // Assert
  expect(result.valid).toBe(true);
});
```

### 3. Test One Thing

```typescript
// ❌ Bad - testing multiple things
it('should work', () => {
  expect(formatDate(...)).toBeTruthy();
  expect(formatTime(...)).toBeTruthy();
  expect(formatDateTime(...)).toBeTruthy();
});

// ✅ Good - separate tests
it('should format date', () => { ... });
it('should format time', () => { ... });
it('should format datetime', () => { ... });
```

### 4. Use Descriptive Assertions

```typescript
// ❌ Bad
expect(result).toBeTruthy();

// ✅ Good
expect(result.valid).toBe(true);
expect(result.message).toBe('');
```

### 5. Test Edge Cases

```typescript
describe('formatCurrency', () => {
  it('should handle positive numbers', () => { ... });
  it('should handle zero', () => { ... });
  it('should handle negative numbers', () => { ... });
  it('should handle large numbers', () => { ... });
  it('should handle decimals', () => { ... });
});
```

## Troubleshooting

### Tests Not Running

**Check Node version:**
```bash
node --version  # Should be >= 18
```

**Reinstall dependencies:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Import Errors

If you see `Cannot find module '@/...'`:

**Check `vitest.config.ts` has correct alias:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Integration Tests Failing

**Make sure app is running:**
```bash
docker-compose up -d

# Verify app is running
curl http://localhost:3000/api/health
```

**Check correct URL:**
```typescript
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
```

### Tests Timing Out

**Increase timeout in vitest.config.ts:**
```typescript
test: {
  testTimeout: 30000, // 30 seconds
}
```

**Or per test:**
```typescript
it('slow test', async () => {
  // Test code
}, 30000); // 30 second timeout
```

## Test Examples

### Testing Async Functions

```typescript
it('should fetch data', async () => {
  const result = await fetchData();
  
  expect(result).toBeDefined();
});
```

### Testing Errors

```typescript
it('should throw error for invalid input', () => {
  expect(() => {
    dangerousFunction();
  }).toThrow('Invalid input');
});
```

### Testing Promises

```typescript
it('should resolve with data', async () => {
  await expect(promise).resolves.toBe('data');
});

it('should reject with error', async () => {
  await expect(promise).rejects.toThrow('Error');
});
```

### Mocking Functions

```typescript
import { vi } from 'vitest';

it('should call callback', () => {
  const callback = vi.fn();
  
  doSomething(callback);
  
  expect(callback).toHaveBeenCalled();
  expect(callback).toHaveBeenCalledWith('arg');
});
```

## Summary

✅ **Fast Testing**: Vitest is extremely fast  
✅ **TypeScript Support**: Native TypeScript support  
✅ **Watch Mode**: Auto-rerun tests on changes  
✅ **UI Mode**: Visual test interface  
✅ **Coverage**: Built-in coverage reporting  
✅ **Easy Setup**: Minimal configuration required  

## Quick Commands Reference

```bash
# Development
npm test                    # Watch mode
npm run test:ui            # Visual UI

# CI/Production
npm run test:run           # Run once
npm run test:coverage      # With coverage

# Specific tests
npm test -- tests/unit                    # Unit tests only
npm test -- tests/integration            # Integration tests only
npm test -- date-utils                   # Tests matching name
```

---

📖 **See Also**:
- [Vitest Documentation](https://vitest.dev)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
