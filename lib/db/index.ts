/**
 * Database client for PLANC
 * Using Drizzle ORM with SQLite (better-sqlite3)
 */

import * as fs from "fs";
import * as path from "path";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Database from "bun:sqlite";
import { DB_PATH } from "@/drizzle.config";

console.debug("NODE_ENV", process.env.NODE_ENV);

// Environment detection
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";

if (IS_PRODUCTION) {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// SQLite database instance
let sqlite: Database | null = null;

function initDatabase(): Database {
  if (sqlite) return sqlite;

  sqlite = new Database(DB_PATH);

  return sqlite;
}

function createDrizzle() {
  const dbInstance = initDatabase();
  return drizzle(dbInstance as Database, { schema });
}

export const db = createDrizzle();
export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
  }
}

export type DB = typeof db;
