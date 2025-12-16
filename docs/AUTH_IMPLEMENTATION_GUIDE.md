# Auth Security Implementation Guide

## Quick Fixes for Critical Issues

### Fix 1: CSRF Protection (30 mins)

**File: `src/server/trpc/init.ts`**

Add CSRF validation middleware. The best approach for tRPC is origin validation:

```typescript
// In createTRPCContext, add:
const origin = headersList.get("origin");
const referer = headersList.get("referer");
const host = headersList.get("host");

// In context return:
return {
  // ... existing
  origin,
  referer,
  host,
};

// Add new middleware:
const csrfMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  // Skip CSRF for queries (they're safe - GET semantics)
  if (type === "query") {
    return next();
  }
  
  // For mutations, verify origin
  const { origin, host } = ctx;
  
  // If origin header exists, validate it
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const hostName = host?.split(":")[0] || "";
      
      if (!originUrl.hostname.includes(hostName)) {
        console.warn(`CSRF attempt: origin=${origin}, host=${host}`);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "CSRF validation failed",
        });
      }
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid CSRF origin",
      });
    }
  }
  
  return next({ ctx });
});

// Update protectedProcedure:
export const protectedProcedure = t.procedure
  .use(loggingMiddleware)
  .use(csrfMiddleware)  // Add before other middleware
  .use(async ({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Musisz być zalogowany",
      });
    }
    // ... rest of middleware
  });

// Update publicProcedure:
export const publicProcedure = t.procedure
  .use(loggingMiddleware)
  .use(csrfMiddleware)  // Add CSRF check even for public mutations
  .use(async ({ ctx, next }) => {
    // ... rate limiting
  });
```

---

### Fix 2: JWT Secret Validation (5 mins)

**File: `src/server/auth/session.ts`**

Replace:
```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);
```

With:
```typescript
// Validate JWT_SECRET on startup
if (!process.env.JWT_SECRET) {
  throw new Error(
    `JWT_SECRET environment variable is not set!\n` +
    `Generate a secure secret with:\n` +
    `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"\n` +
    `Then set it in your .env file as: JWT_SECRET=<generated-value>`
  );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
```

---

### Fix 3: Secure Cookie Configuration (10 mins)

**File: `src/server/auth/session.ts`**

In `createSession()` function, replace:
```typescript
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  expires: expiresAt,
  path: "/",
});
```

With:
```typescript
const isProduction = process.env.NODE_ENV === "production";

cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: isProduction ? true : false,  // Explicit, or always true if possible
  sameSite: isProduction ? "strict" : "lax",  // More restrictive in production
  expires: expiresAt,
  path: "/",
  domain: process.env.COOKIE_DOMAIN,  // Optional but recommended
});
```

Update your `.env.production`:
```env
COOKIE_DOMAIN=yourdomain.com
NODE_ENV=production
```

---

### Fix 4: Token Rotation (2-3 hours)

This is more involved. Add to your database schema first:

**File: `src/server/db/schema.ts`** (if not already there)

```typescript
// Update sessions table
export const sessions = pgTable("sessions", {
  id: text().primaryKey().default(sql`uuid_generate_v4()`),
  userId: text()
    .notNull()
    .references(() => users.id),
  
  // Tokens
  accessToken: text().notNull(),
  refreshToken: text().notNull(),
  
  // Expiration times
  accessTokenExpiresAt: timestamp().notNull(),
  refreshTokenExpiresAt: timestamp().notNull(),
  
  // Tracking
  userAgent: text(),
  ipAddress: text(),
  
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
  lastUsedAt: timestamp(),
});
```

Then update session creation:

**File: `src/server/auth/session.ts`**

```typescript
const ACCESS_TOKEN_DURATION = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_DURATION = 60 * 24 * 60 * 60 * 1000; // 60 days

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const now = new Date();
  const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_DURATION);
  const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_DURATION);

  // Create JWT tokens
  const accessToken = await createToken({
    sessionId: uuid(), // Generate unique session ID
    expiresAt: accessTokenExpiresAt,
  });
  
  const refreshToken = await createToken({
    sessionId: uuid(),
    expiresAt: refreshTokenExpiresAt,
  });

  // Store in database
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      userAgent,
      ipAddress,
    })
    .returning();

  if (!session) {
    throw new Error("Failed to create session");
  }

  // Set SHORT-LIVED access token in httpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: accessTokenExpiresAt,
    path: "/",
  });

  // Set LONG-LIVED refresh token in separate httpOnly cookie
  cookieStore.set(`${SESSION_COOKIE_NAME}_refresh`, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: refreshTokenExpiresAt,
    path: "/",
  });
}

// New: Refresh access token
export async function refreshAccessToken(): Promise<void> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(`${SESSION_COOKIE_NAME}_refresh`)?.value;

  if (!refreshToken) {
    throw new Error("No refresh token");
  }

  const payload = await verifyToken(refreshToken);
  if (!payload) {
    throw new Error("Invalid refresh token");
  }

  // Get session
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshToken, refreshToken))
    .limit(1);

  if (!session || session.refreshTokenExpiresAt < new Date()) {
    throw new Error("Refresh token expired");
  }

  // Generate new access token
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_DURATION);
  const newAccessToken = await createToken({
    sessionId: payload.sessionId,
    expiresAt: accessTokenExpiresAt,
  });

  // Update session
  await db
    .update(sessions)
    .set({ 
      accessToken: newAccessToken,
      accessTokenExpiresAt,
      lastUsedAt: new Date(),
    })
    .where(eq(sessions.id, session.id));

  // Update cookie
  cookieStore.set(SESSION_COOKIE_NAME, newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: accessTokenExpiresAt,
    path: "/",
  });
}
```

---

### Fix 5: Add Email Verification (1-2 hours)

**Update schema:**
```typescript
export const users = pgTable("users", {
  // ... existing fields
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  emailVerificationToken: text(),
  emailVerificationExpiresAt: timestamp(),
});
```

**In auth router:**
```typescript
sendVerificationEmail: publicProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationExpiresAt: expiresAt })
      .where(eq(users.id, user.id));

    // Send email (implement with your email service)
    // await sendEmail({
    //   to: user.email,
    //   template: 'verify-email',
    //   data: { link: `${process.env.NEXTAUTH_URL}/verify?token=${token}` }
    // });

    return { success: true };
  }),

verifyEmail: publicProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, input.token),
    });

    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new TRPCError({ code: "INVALID_REQUEST", message: "Token expired or invalid" });
    }

    await db
      .update(users)
      .set({ 
        emailVerified: true, 
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    return { success: true };
  }),
```

---

## Testing Your Fixes

### Test CSRF Protection:
```bash
# This should fail:
curl -X POST https://yourdomain.com/trpc/invoice.delete \
  -H "Origin: http://attacker.com" \
  -H "Content-Type: application/json"

# This should succeed:
curl -X POST https://yourdomain.com/trpc/invoice.delete \
  -H "Origin: https://yourdomain.com" \
  -H "Content-Type: application/json"
```

### Test Secure Cookies:
```bash
# Check cookie flags in browser DevTools > Application > Cookies
# Verify:
# ✅ HttpOnly = true
# ✅ Secure = true (in production)
# ✅ SameSite = Strict (production) or Lax (dev)
```

### Test JWT Secret:
```bash
# Remove JWT_SECRET and restart
# Server should fail to start with clear error message
```

---

## Environment Variables

Add to `.env.local`:
```env
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SESSION_COOKIE_NAME=mobifaktura_session
COOKIE_DOMAIN=localhost
NODE_ENV=development
```

Add to `.env.production`:
```env
JWT_SECRET=<production-secret>
SESSION_COOKIE_NAME=mobifaktura_session
COOKIE_DOMAIN=yourdomain.com
NODE_ENV=production
```

---

## After Implementing These Fixes

Your auth becomes:
- ✅ CSRF-protected
- ✅ Properly secured with tokens
- ✅ Requires explicit JWT secret
- ✅ Has token rotation (optional but recommended)
- ✅ Production-ready

This is comparable to:
- Better Auth for basic use cases
- Better than default NextAuth for customization
- Ready to scale and reuse across projects
