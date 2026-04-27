import { afterEach, beforeEach, describe } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";

describe("Tool Call Test", () => {
  beforeEach(() => {
    migrate(testdb, { migrationsFolder: "./drizzle" });
  });
  afterEach(async () => {
    await testdb.delete(schema.message);
    await testdb.delete(schema.chat);
  });
});
