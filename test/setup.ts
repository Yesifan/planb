// test-setup.ts
import "@/envConfig";

import { plugin } from "bun";
import { beforeAll, beforeEach } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { matterBunLoader } from "@/loader/matter";

plugin({
  name: "next-js-polyfills",
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, matterBunLoader);
  },
});

beforeAll(() => {
  migrate(testdb, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Clear tables if they exist - for tests that run before migrations are applied

  await testdb.delete(schema.messages);
  await testdb.delete(schema.chat);
  await testdb.delete(schema.session);
  await testdb.delete(schema.account);
  await testdb.delete(schema.verification);
  await testdb.delete(schema.user);

  // Better Auth tables will be cleared when needed in tests
  // user, session, account, verification are created by Better Auth migrations
});
