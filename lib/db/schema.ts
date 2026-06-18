/**
 * Database schema for PLANC
 * Using Drizzle ORM with SQLite
 */

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { AllToolKeys } from "../llm/tool";
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
    enum: ["system", "user", "assistant"],
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
    enum: AllToolKeys,
  }).notNull(),
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
  worldview: text("worldview"),
  system: text("system"),
  worldSnapshot: text("world_snapshot"),
  taskState: text("task_state"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export type ProtagonistDimension = {
  name: string;
  value: number;
  summary: string;
};

export const protagonistState = sqliteTable("protagonist_state", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  profile: text("profile").notNull(),
  resources: text("resources"),
  dimensions: text("dimensions", { mode: "json" })
    .$type<ProtagonistDimension[]>()
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
});

export const history = sqliteTable("history", {
  id: text("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

// Export types
export type Chat = typeof chat.$inferSelect;
export type NewChat = typeof chat.$inferInsert;
export type Message = typeof message.$inferSelect;
export type NewMessage = typeof message.$inferInsert;
export type Story = typeof story.$inferSelect;
export type ProtagonistState = typeof protagonistState.$inferSelect;
export type History = typeof history.$inferSelect;

export type ToolCall = typeof toolCall.$inferSelect;

export type MessageWithToolCall = Message & {
  toolCalls: ToolCall[];
};
