import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { relations } from "./relations";
import * as schema from "./schema";

// SQLite database instance
const DB_FILE_NAME = process.env.DB_FILE_NAME ?? "planb.sqlite";
console.debug("DB_FILE_NAME", DB_FILE_NAME);
const sqlite = new Database(process.env.DB_FILE_NAME ?? "planb.sqlite");
export const db = drizzle({ client: sqlite, schema, relations });

export function closeDatabase() {
  sqlite.close();
}

export type DB = typeof db;
