/**
 * Database client for PLANC
 * Using Drizzle ORM with SQLite (better-sqlite3)
 */

import * as fs from "fs";
import * as path from "path";
import * as schema from "./schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import Database from "bun:sqlite";

console.debug("NODE_ENV", process.env.NODE_ENV);

const dbName = "planb.db";

const currentDir = __dirname;

// Environment detection
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_TEST = NODE_ENV === "test";
const IS_PRODUCTION = NODE_ENV === "production";
const DATABASE_URL = process.env.DATABASE_URL;

const DEV_DATABASE_URL = path.join(
  path.dirname(path.dirname(currentDir)),
  dbName,
);

const DB_PATH = IS_TEST
  ? ":memory:"
  : IS_PRODUCTION
    ? (DATABASE_URL ?? DEV_DATABASE_URL)
    : DEV_DATABASE_URL;

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
