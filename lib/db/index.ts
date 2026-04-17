import * as schema from "./schema";
import { relations } from "./relations";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

// SQLite database instance
const DB_FILE_NAME = process.env.DB_FILE_NAME ?? "planb.sqlite";
console.debug("DB_FILE_NAME", DB_FILE_NAME);
const sqlite = new Database(process.env.DB_FILE_NAME ?? "planb.sqlite");
export const db = drizzle({ client: sqlite, schema, relations });

export function closeDatabase() {
  sqlite.close();
}

export type DB = typeof db;
