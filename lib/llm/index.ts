import z from "zod";

import Arbiter from "@/planb/agents/Arbiter.md";
import Archivist from "@/planb/agents/Archivist.md";
import ExMachina from "@/planb/agents/ExMachina.md";
import Oracle from "@/planb/agents/Oracle.md";
import Sentinel from "@/planb/agents/Sentinel.md";
import System from "@/planb/agents/System.md";
import Weaver from "@/planb/agents/Weaver.md";

import { createAgent } from "./agent";
import { provider } from "./provider";
import Tools from "./tool";

type PickTools<K extends keyof typeof Tools> = Pick<typeof Tools, K>;

// Schema for validating Archivist agent output
export const ArchivistOutputSchema = z.object({
  title: z.string().min(1),
  type: z.string().min(1, "Story type cannot be empty"),
  describe: z.string().min(1, "Story description cannot be empty"),
  worldview: z.string().min(1, "Worldview cannot be empty"),
});

export const arbiter = createAgent("Arbiter", provider, Arbiter);
export const sentinel = createAgent<PickTools<"judgeInput">>("Sentinel", provider, Sentinel);
export const archivist = createAgent("Archivist", provider, Archivist);
export const exMachina = createAgent<PickTools<"saveSystemSetting">>("ExMachina", provider, ExMachina);
export const oracle = createAgent("Oracle", provider, Oracle);
export const system = createAgent("System", provider, System);
export const weaver = createAgent("Weaver", provider, Weaver);

export { primaryModel, provider, secondaryModel } from "./provider";
