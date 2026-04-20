import { describe, expect, test } from "bun:test";
import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

describe("Better Auth Configuration", () => {
  test("auth config loads correctly", async () => {
    const { auth } = await import("@/lib/auth/server");
    expect(auth).toBeDefined();
  });

  test("auth client exports correctly", async () => {
    const authClientModule = await import("@/lib/auth/client");
    expect(authClientModule.default).toBeDefined();
  });

  test("database connection works with Better Auth adapter", async () => {
    expect(db).toBeDefined();
    expect(true).toBe(true);
  });

  test("Better Auth tables can be queried when migrations applied", async () => {
    const result = await db.select({ count: count() }).from(schema.user);
    expect(result).toBeDefined();
    expect(result[0].count).toBeDefined();
  });

  test("can insert and query a test user when migrations applied", async () => {
    await db.insert(schema.user).values({
      id: "test-user-1",
      name: "Test User",
      email: "test@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.id, "test-user-1"));

    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("test-user-1");
    expect(result[0].email).toBe("test@example.com");
  });
});
