/**
 * Database schema for PLANC
 * Using Drizzle ORM with SQLite
 */

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
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
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["system", "user", "assistant", "tool"],
  }).notNull(),
  content: text("content").notNull(),
  toolCalls: text("tool_calls"),
  toolCallId: text("tool_call_id"),
  agent: text("agent"),
  model: text("model"),
  tokens: integer("tokens"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const story = sqliteTable("story", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  singularity: text("singularity").notNull(),
  type: text("type").notNull(),
  describe: text("describe").notNull(),
  worldview: text("worldview").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  content: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Export types
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Story = typeof story.$inferSelect;
