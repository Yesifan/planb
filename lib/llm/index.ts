import Arbiter from "@/planb/agents/Arbiter.md";
import Archivist from "@/planb/agents/Archivist.md";
import Titler from "@/planb/agents/Titler.md";

import { createAgent } from "./agent";
import { provider } from "./provider";

export const ArbiterAgent = createAgent("Arbiter", provider, Arbiter);
export const ArchivistAgent = createAgent("Archivist", provider, Archivist);
export const TitlerAgent = createAgent("Titler", provider, Titler);

export { primaryModel, provider, secondaryModel } from "./provider";
