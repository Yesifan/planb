"use server";
import { nanoid } from "nanoid";

import { getSessionWithRedirect } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { chat, story } from "@/lib/db/schema";
import { ArchivistAgent, ArchivistOutputSchema } from "@/lib/llm";

export async function createStory(source: string, singularity: string) {
  // 1. Input Validation
  if (!source || source.trim().length === 0) {
    throw new Error("Story source cannot be empty");
  }
  if (!singularity || singularity.trim().length === 0) {
    throw new Error("Singularity cannot be empty");
  }

  // 2. Session Validation
  const session = await getSessionWithRedirect();

  try {
    // 3. Call Archivist Agent with output schema validation
    const prompt = `source: ${source}\n singularity: ${singularity}`;

    const result = await ArchivistAgent.generate({
      prompt,
      experimental_context: { db },
    });
    const json = JSON.parse(result.output);
    const output = await ArchivistOutputSchema.parseAsync(json);

    // 4. Database Operations - Create chat first, then story
    const chatId = nanoid();
    const storyId = nanoid();
    const now = new Date();

    // First insert into chat table
    await db.insert(chat).values({
      id: chatId,
      userId: session.user.id,
      title: output.title, // Use first 50 chars of source as title
      createdAt: now,
      updatedAt: now,
    });

    // Then insert into story table
    await db.insert(story).values({
      id: storyId,
      chatId,
      source,
      singularity,
      type: output.type,
      describe: output.describe,
      worldview: output.worldview,
      createdAt: now,
      updatedAt: now,
    });

    // 5. Return result
    return chatId;
  } catch (error) {
    console.log(error);
    console.error("Error in createStory:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to create story. Please try again.");
  }
}
