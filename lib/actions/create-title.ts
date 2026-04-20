"use server";
import { db } from "@/lib/db";
import { TitlerAgent } from "@/lib/llm";

export async function createTitle(formData: FormData) {
  const result = await TitlerAgent.generate({
    prompt: "",
    experimental_context: { db, sessionId: "" },
  });
  console.debug(result);
}
