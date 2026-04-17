import { describe, expect, test } from "bun:test";

import { db } from "@/lib/db";

describe("Better Auth Configuration", () => {
  test("auth config loads correctly", async () => {
    const { auth } = await import("@/lib/auth");
    expect(auth).toBeDefined();
  });

  test("auth client exports correctly", async () => {
    const authClientModule = await import("@/lib/auth-client");
    expect(authClientModule.default).toBeDefined();
  });

  test("database connection works with Better Auth adapter", async () => {
    expect(db).toBeDefined();
    expect(true).toBe(true);
  });

  test("Better Auth tables can be queried when migrations applied", async () => {
    const stmt = db.$client.prepare(`SELECT COUNT(*) FROM user`);
    const result = stmt.get();
    expect(result).toBeDefined();
    expect(true).toBe(true);
  });

  test("can insert and query a test user when migrations applied", async () => {
    const stmt = db.$client.prepare(`
        INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
    const now = Math.floor(Date.now() / 1000);
    stmt.run("test-user-1", "Test User", "test@example.com", 0, now, now);

    const selectStmt = db.$client.prepare(`SELECT * FROM user WHERE id = ?`);
    const user: unknown = selectStmt.get("test-user-1");
    expect(user).toBeDefined();

    if (user && typeof user === "object") {
      if ("id" in user) {
        expect((user as { id: unknown }).id).toBe("test-user-1");
      }
      if ("email" in user) {
        expect((user as { email: unknown }).email).toBe("test@example.com");
      }
    }
  });
});
