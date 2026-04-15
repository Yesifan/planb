import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

import type { ToolLoopAgentSettings, ToolSet } from "ai";

import { ConfigValidationError } from "./errors";
import Tools from "./tool";
import { AgentSchema } from "./type";

const AGENTS_DIR = path.resolve(__dirname, "../../planb/agents");

export async function loadAgentsConfig() {
  const entries = await fs.readdir(AGENTS_DIR, { withFileTypes: true });

  const agentPromises = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map(async (entry) => {
      const agentName = entry.name.split(".")[0];
      const fullPath = path.join(AGENTS_DIR, entry.name);
      const content = await fs.readFile(fullPath);
      const { data, content: instructions } = matter(content);

      const result = AgentSchema.safeParse(data);
      if (!result.success) {
        throw new ConfigValidationError({
          configPath: fullPath,
          originalContent: content.toString("utf8"),
          message: result.error.message,
          cause: result.error,
        });
      }
      const { model, tools, ...config } = result.data;

      const toolset = tools?.reduce<ToolSet>((acc, toolName) => {
        if (toolName in Tools) {
          acc[toolName] = Tools[toolName as keyof typeof Tools];
        } else {
          console.debug(`${toolName} tool not found with ${agentName} agent!`);
        }
        return acc;
      }, {});

      const agentSettings: ToolLoopAgentSettings = {
        model: model ?? "primay",
        instructions: instructions,
        tools: toolset,
        ...config,
      };

      return [agentName, agentSettings] as const;
    });

  return await Promise.all(agentPromises);
}
