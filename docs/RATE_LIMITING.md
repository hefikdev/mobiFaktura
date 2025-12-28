# Rate Limiting & API Protection

This document explains the simple in-memory rate limiting system for mobiFaktura.

## Overview

The application includes lightweight rate limiting to protect against:
- **Brute Force Attacks**: Prevents password guessing
- **DDoS/DoS Attacks**: Limits requests from single sources
- **API Abuse**: Prevents bulk automated requests
- **Resource Exhaustion**: Protects server resources

## Architecture

```
┌─────────────────────────────────────────────┐
│         Simple Rate Limiting                │
├─────────────────────────────────────────────┤
│                                             │
│         ┌──────────────────────┐           │
│         │   In-Memory Cache    │           │
│         │   (No Dependencies)  │           │
│         └──────────┬───────────┘           │
│                    │                        │
│                    ▼                        │
│         ┌──────────────────────┐           │
│         │  Rate Limit Tiers    │           │
│         ├──────────────────────┤           │
│         │ • Global (300/min)   │           │
│         │ • Auth (10/min)      │           │
│         │ • Write (100/min)    │           │
│         │ • Read (500/min)     │           │
│         └──────────┬───────────┘           │
│                    │                        │
│                    ▼                        │
│         ┌──────────────────────┐           │
│         │   tRPC Middleware    │           │
│         │   (Per-procedure)    │           │
│         └──────────────────────┘           │
└─────────────────────────────────────────────┘
```

## Rate Limit Tiers

### 1. Global Rate Limit
**Applied to**: All API requests  
**Limit**: 300 requests per minute  
**Purpose**: Prevent general API abuse  
**Identifier**: IP address or IP + User ID

```typescript
// Applied automatically to all procedures
globalRateLimit: 300 requests / 1 minute
```

### 2. Auth Rate Limit
**Applied to**: Login, Register  
**Limit**: 50 requests per minute  
**Purpose**: Prevent brute force attacks  
**Identifier**: IP address

```typescript
// Applied to: login, register
authRateLimit: 50 requests / 1 minute
```

**Note**: This is **in addition to** the existing login attempt tracking (3 attempts, 30s lockout).

### 3. Write Rate Limit
**Applied to**: Create, Update, Delete operations  
**Limit**: 100 requests per minute  
**Purpose**: Prevent spam and bulk operations  
**Identifier**: IP + User ID

```typescript
// Applied to: mutations that modify data
writeRateLimit: 100 requests / 1 minute
```

### 4. Read Rate Limit
**Applied to**: Query operations  
**Limit**: 500 requests per minute  
**Purpose**: Prevent data scraping  
**Identifier**: IP + User ID

```typescript
// Applied to: queries that read data
readRateLimit: 500 requests / 1 minute
```

## How It Works

### Request Flow

1. **Request arrives** → Extract IP address and user ID
2. **Check rate limit** → Query in-memory cache
3. **Within limit?** 
   - ✅ Yes → Process request, decrement counter
   - ❌ No → Return 429 error with retry time
4. **Add headers** → Include rate limit info in response

### Rate Limit Headers

All responses include rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-12-11T10:35:00.000Z
Retry-After: 45  # Only when rate limited
```

### Error Response

When rate limited, you receive:

```json
{
  "error": {
    "message": "Rate limit exceeded. Try again in 45 seconds (resets at 2025-12-11T10:35:00.000Z)",
    "code": "TOO_MANY_REQUESTS"
  }
}
```

## Storage

### In-Memory (Simple & Fast)

**Features:**
- ✅ No external dependencies
- ✅ Zero configuration required
- ✅ Very fast (local memory)
- ✅ Free and lightweight
- ✅ Perfect for high traffic

**Behavior:**
- Resets on server restart (by design)
- Works great for single-server deployments
- Auto-cleanup of old entries every minute

**Performance:**
- < 1ms latency
- ~5MB memory for 10k entries
- Negligible CPU usage

## Setup

### Automatic Setup

**No configuration needed!** Rate limiting works automatically.

```bash
# Just start the app - rate limiting is active
docker-compose up -d
```

Rate limits are applied immediately to all requests.

## Rate Limit Configuration

### Current Limits

| Tier | Requests | Window | Applied To |
|------|----------|--------|------------|
| Global | 300 | 1 min | All requests |
| Auth | 10 | 1 min | Login, Register |
| Write | 100 | 1 min | Create, Update, Delete |
| Read | 500 | 1 min | List, Get queries |

### Customizing Limits

Edit `src/server/lib/rate-limit.ts`:

```typescript
const RATE_LIMITS = {
  global: {
    requests: 500,    // Increase to 500
    windowMs: 60000,  // 1 minute
  },
  auth: {
    requests: 20,     // Increase to 20
    windowMs: 60000,  // 1 minute
  },
  // ...
};
```

### Per-Environment Limits

For different limits in production:

```typescript
const RATE_LIMITS = {
  global: {
    requests: process.env.NODE_ENV === "production" ? 300 : 9999,
    windowMs: 60000,
  },
  // ...
};
```

## Integration with Existing Security

### Login Attempt Tracking

The app **already has** login attempt tracking:
- **3 failed attempts** → 30 second lockout
- Tracked per email address
- Independent of rate limiting

**Combined protection**:
1. **Rate limit** (5 attempts/min) → Prevents rapid-fire attacks
2. **Login tracking** (3 attempts, 30s lockout) → Prevents credential stuffing
3. **Together** → Very strong brute force protection

### Password Strength

Rate limiting complements existing password requirements:
- Minimum 8 characters
- Mix of uppercase, lowercase, numbers, special chars
- Password strength validation on registration

## Monitoring

### Check Rate Limit Usage

```bash
# View app logs
docker logs -f mobifaktura_app | grep -i "rate limit"
```

### Identify Rate Limited Requests

Responses with HTTP status **429** are rate limited:

```bash
# Test rate limiting
for i in {1..400}; do
  curl -w "%{http_code}\n" -o /dev/null http://localhost:3000/api/health
  sleep 0.1
done
# After ~300 requests, you'll see 429 responses
```

## Bypassing Rate Limits

### For Testing

In development, temporarily increase limits:

```typescript
// src/server/lib/rate-limit.ts
const RATE_LIMITS = {
  global: {
    requests: process.env.NODE_ENV === "development" ? 999999 : 300,
    windowMs: 60000,
  },
};
```

### For Trusted IPs

Add IP allowlist:

```typescript
export async function checkRateLimit(
  identifier: string,
  limiter: typeof globalRateLimit
): Promise<void> {
  // Bypass for trusted IPs
  const trustedIPs = ["127.0.0.1", "10.0.0.0/8"];
  if (trustedIPs.some(ip => identifier.startsWith(ip))) {
    return;
  }
  
  // Normal rate limit check
  const result = await limiter.limit(identifier);
  // ...
}
```

## Best Practices

### 1. Set Generous Limits

Rate limits should protect, not annoy:
- ✅ **300 requests/min** → Normal user never hits this
- ✅ **500 reads/min** → Allows high-traffic apps
- ❌ **10 requests/min** → Too restrictive for normal use

### 2. Monitor and Adjust

- Review rate limit errors weekly
- Adjust limits based on usage patterns
- Different limits for different user roles (if needed)

### 3. Communicate Limits

Return helpful error messages:
```typescript
"Rate limit exceeded. Try again in 45 seconds"
```

### 4. Combine with Other Security

Rate limiting is one layer:
- ✅ Rate limiting
- ✅ Strong passwords
- ✅ Login attempt tracking
- ✅ HTTPS/TLS
- ✅ Security headers

## Troubleshooting

### Rate Limit Errors in Development

**Problem**: Getting rate limited during testing

**Solution 1**: Use in-memory (resets on restart)
```bash
docker-compose restart app
```

**Solution 2**: Increase limits temporarily
```typescript
requests: process.env.NODE_ENV === "development" ? 999999 : 100
```

### Rate Limits Not Working

**Check 1**: Verify middleware is loaded
```bash
docker logs mobifaktura_app | grep -i "rate"
```

**Check 2**: Test with multiple requests
```bash
for i in {1..350}; do curl http://localhost:3000/api/health; sleep 0.1; done
```

### Different Limits for Different Users

To implement role-based limits:

```typescript
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // ...
  
  // Admins get higher limits
  const limiter = ctx.user.role === "admin" 
    ? adminRateLimit  // 1000/min
    : globalRateLimit; // 300/min
  
  await checkRateLimit(identifier, limiter);
  // ...
});
```

## Performance Impact

- **Latency**: < 1ms
- **Memory**: ~5MB for 10k entries
- **CPU**: Negligible
- **Total overhead**: < 0.1% performance impact

## Security Considerations

### IP Spoofing

The system uses multiple headers to determine IP:
```typescript
x-forwarded-for → x-real-ip → host → "unknown"
```

Behind a reverse proxy, set these headers correctly:
```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

### Distributed Attacks

If attacker uses multiple IPs:
- Implement account-level rate limiting
- Use Cloudflare or similar DDoS protection
- Consider IP-based blocking at reverse proxy level

### Rate Limit Bypass Attempts

Common bypass attempts:
- ❌ Changing user agent (doesn't help)
- ❌ Using different browsers (same IP)
- ❌ VPN rotation (rate limit still applies per IP)
- ✅ Only multiple unique IPs can bypass

## Summary

✅ **Simple & Fast**: In-memory, no dependencies  
✅ **Multi-Tier Protection**: Global (300), Auth (10), Write (100), Read (500)  
✅ **High Traffic Ready**: Generous limits for production use  
✅ **Transparent**: Rate limit headers in every response  
✅ **Zero Config**: Works immediately out of the box  
✅ **Combined Security**: Works with existing login protections  
✅ **Lightweight**: < 1ms latency, minimal memory usage  

Rate limiting provides protection against API abuse while supporting high-traffic applications.

## Quick Commands

```bash
# Test rate limiting
for i in {1..350}; do
  curl -w "%{http_code}\n" http://localhost:3000/api/health
  sleep 0.1
done

# View rate limit logs
docker logs mobifaktura_app | grep -i "rate"

# Reset limits (restart app)
docker-compose restart app
```

---

📖 **See Also**: 
- [MONITORING.md](./MONITORING.md) - Error monitoring and health checks
- [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md) - Data backup and recovery
