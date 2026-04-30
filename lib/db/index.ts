import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { relations } from "./relations";
import * as schema from "./schema";

// SQLite database instance
const DB_FILE_NAME = process.env.DB_FILE_NAME ?? "planb.sqlite";
console.debug("DB_FILE_NAME", DB_FILE_NAME);

const sqlite = new Database(process.env.DB_FILE_NAME ?? "planb.sqlite");
sqlite.run("PRAGMA journal_mode = WAL;");
sqlite.run("PRAGMA synchronous = NORMAL;");
sqlite.run("PRAGMA cache_size = -20000;"); // 增加缓存大小 (约 20MB)
sqlite.run("PRAGMA temp_store = MEMORY;"); // 将临时表存储在内存中
export const db = drizzle({ client: sqlite, schema, relations });

export type DB = typeof db;
