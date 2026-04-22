import z from "zod";

import Arbiter from "@/planb/agents/Arbiter.md";
import Archivist from "@/planb/agents/Archivist.md";

import { createAgent } from "./agent";
import { provider } from "./provider";

// Schema for validating Archivist agent output
export const ArchivistOutputSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1, "Story type cannot be empty"),
  describe: z.string().min(1, "Story description cannot be empty"),
  worldview: z.string().min(1, "Worldview cannot be empty"),
});

export const ArbiterAgent = createAgent("Arbiter", provider, Arbiter);
export const ArchivistAgent = createAgent("Archivist", provider, Archivist);

export { primaryModel, provider, secondaryModel } from "./provider";
