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
  await testdb.delete(schema.messages);
  await testdb.delete(schema.sessions);
  await testdb.delete(schema.users);
});
