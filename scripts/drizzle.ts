import "../envConfig";

import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";

console.debug("DB_FILE_NAME", process.env.DB_FILE_NAME);

migrate(testdb, { migrationsFolder: "./drizzle" });

console.log("🚀 migrate success!");
