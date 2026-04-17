import { provider } from "./provider";
import { createAgent } from "./agent";

import Titler from "@/planb/agents/Titler.md";
import Arbiter from "@/planb/agents/Arbiter.md";

export const ArbiterAgent = createAgent("Arbiter", provider, Arbiter);
export const TitlerAgent = createAgent("Titler", provider, Titler);

export { provider, primaryModel, secondaryModel } from "./provider";
