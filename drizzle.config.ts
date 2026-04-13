import * as path from "path";
import { defineConfig } from "drizzle-kit";

const dbName = "planb.db";

const currentDir = __dirname;
const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
const cacheDir = `${homeDir}/.cache/planb`;

// Environment detection
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_TEST = NODE_ENV === "test";
const IS_PRODUCTION = NODE_ENV === "production";
const DATABASE_URL = process.env.DATABASE_URL ?? path.join(cacheDir, dbName);
const DEV_DATABASE_URL = path.join(
  path.dirname(path.dirname(currentDir)),
  dbName,
);

export const DB_PATH = IS_TEST
  ? ":memory:"
  : IS_PRODUCTION
    ? DATABASE_URL
    : DEV_DATABASE_URL;

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
});
