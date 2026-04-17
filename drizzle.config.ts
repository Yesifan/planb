import { defineConfig } from "drizzle-kit";
import "./envConfig";

console.debug("DB_FILE_NAME", process.env.DB_FILE_NAME);

export default defineConfig({
  out: "./drizzle",
  schema: "./lib/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? "planb.sqlite",
  },
});
