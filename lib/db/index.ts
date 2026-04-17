import * as schema from "./schema";
import { relations } from "./relations";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

// SQLite database instance
const sqlite = new Database(process.env.DB_FILE_NAME ?? "planb.sqlite");
export const db = drizzle({ client: sqlite, schema, relations });

export function closeDatabase() {
  sqlite.close();
}

export type DB = typeof db;
