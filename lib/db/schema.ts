/**
 * Database schema for PLANC
 * Using Drizzle ORM with SQLite
 */

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import Tools from "../llm/tool";
export * from "./auth-schema";

/**
 * Chat table - stores chat sessions
 */
export const chat = sqliteTable("chat", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  title: text("title").notNull().default("New Session"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Messages table - stores chat messages
 */
export const message = sqliteTable("message", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  agent: text("agent"),
  model: text("model"),
  role: text("role", {
    enum: ["system", "user", "assistant", "tool"],
  }).notNull(),
  text: text("text").notNull(),
  reasoning: text("reasoning"),
  outputTokens: integer("output_tokens"),
  inputTokens: integer("input_tokens"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const toolCall = sqliteTable("toolcall", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  name: text("tool_calls", {
    enum: Object.keys(Tools) as [keyof typeof Tools],
  }),
  input: text("input", { mode: "json" }).notNull(),
  result: text("result"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const story = sqliteTable("story", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  source: text("source").notNull(),
  singularity: text("singularity").notNull(),
  type: text("type"),
  describe: text("describe"),
  worldview: text("worldview"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  content: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Export types
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;
export type Story = typeof story.$inferSelect;
