import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Mock dependencies
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => []),
          })),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/logger", () => ({
  apiLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  trpcLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  logError: vi.fn(),
}));

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock react cache
vi.mock("react", () => ({
  cache: (fn: unknown) => fn,
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
  headers: vi.fn(() => new Map()),
}));

// Mock fetch
global.fetch = vi.fn();

describe("KSeF Token Logic", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const mockCtx = { 
    user: { id: "user-1", role: "admin" },
    session: { id: "session-1", userId: "user-1" },
    db: {},
    ipAddress: "127.0.0.1",
    userAgent: "test",
  } as unknown as Record<string, unknown>;

  it("should use default KSEF_TOKEN when no NIP is provided", async () => {
    process.env.KSEF_TOKEN = "default-token";
    
    const { ksefRouter } = await import("@/server/trpc/routers/ksef");
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: { token: "session-123" } }),
    } as Response);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<xml></xml>",
    } as Response);

    const { db } = await import("@/server/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof db.select>);

    const caller = ksefRouter.createCaller(mockCtx as any);

    await caller.verifyInvoice({ ksefNumber: "123456789012345678901234567890123456" });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("Session/AuthorisationToken"),
      expect.objectContaining({
        body: JSON.stringify({ token: "default-token" }),
      })
    );
  });

  it("should use company-specific token when NIP is provided", async () => {
    process.env.KSEF_TOKEN = "default-token";
    process.env.KSEF_TOKEN_1234567890 = "company-token";
    
    const { ksefRouter } = await import("@/server/trpc/routers/ksef");
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: { token: "session-123" } }),
    } as Response);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<xml></xml>",
    } as Response);

    const { db } = await import("@/server/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ nip: "123-456-78-90" }]),
    } as unknown as ReturnType<typeof db.select>);

    const caller = ksefRouter.createCaller(mockCtx as any);

    await caller.verifyInvoice({ 
      ksefNumber: "123456789012345678901234567890123456",
      invoiceId: "00000000-0000-0000-0000-000000000000"
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("Session/AuthorisationToken"),
      expect.objectContaining({
        body: JSON.stringify({ token: "company-token" }),
      })
    );
  });

  it("should fallback to default token if company-specific token is missing", async () => {
    process.env.KSEF_TOKEN = "default-token";
    
    const { ksefRouter } = await import("@/server/trpc/routers/ksef");
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: { token: "session-123" } }),
    } as Response);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<xml></xml>",
    } as Response);

    const { db } = await import("@/server/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ nip: "1234567890" }]),
    } as unknown as ReturnType<typeof db.select>);

    const caller = ksefRouter.createCaller(mockCtx as any);

    await caller.verifyInvoice({ 
      ksefNumber: "123456789012345678901234567890123456",
      invoiceId: "00000000-0000-0000-0000-000000000000"
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("Session/AuthorisationToken"),
      expect.objectContaining({
        body: JSON.stringify({ token: "default-token" }),
      })
    );
  });

  it("should throw error if no token is found", async () => {
    delete process.env.KSEF_TOKEN;
    
    const { ksefRouter } = await import("@/server/trpc/routers/ksef");
    
    const { db } = await import("@/server/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ nip: "1234567890" }]),
    } as unknown as ReturnType<typeof db.select>);

    const caller = ksefRouter.createCaller(mockCtx as any);

    await expect(caller.verifyInvoice({ 
      ksefNumber: "123456789012345678901234567890123456",
      invoiceId: "00000000-0000-0000-0000-000000000000"
    })).rejects.toThrow(/KSeF token not configured/);
  });

  it("should correctly format NIP by removing non-digits", async () => {
    process.env.KSEF_TOKEN_1234567890 = "formatted-nip-token";
    
    const { ksefRouter } = await import("@/server/trpc/routers/ksef");
    
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: { token: "session-123" } }),
    } as Response);
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      text: async () => "<xml></xml>",
    } as Response);

    const { db } = await import("@/server/db");
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ nip: "PL 123-456-78-90" }]),
    } as unknown as ReturnType<typeof db.select>);

    const caller = ksefRouter.createCaller(mockCtx as any);

    await caller.verifyInvoice({ 
      ksefNumber: "123456789012345678901234567890123456",
      invoiceId: "00000000-0000-0000-0000-000000000000"
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("Session/AuthorisationToken"),
      expect.objectContaining({
        body: JSON.stringify({ token: "formatted-nip-token" }),
      })
    );
  });
});
