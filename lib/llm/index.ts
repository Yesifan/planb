import path from "node:path";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { Agent, LanguageModel, ModelMessage, ToolLoopAgent } from "ai";

import {
  AgentId,
  Provider,
  LLMConfigSchema,
  LLMConfig,
  PlanbProvider,
} from "./type";
import { createPlanbCompatible } from "./provider";
import {
  AgentNotFoundError,
  AgentUnInitialized,
  ConfigValidationError,
} from "./errors";
import { loadAgentsConfig } from "./agent";

const homeDir = process.env.HOME || process.env.USERPROFILE || "/tmp";
const configDir = `${homeDir}/.config/planb`;

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = NODE_ENV === "production";
const ENV_CONFIG_PATH =
  process.env.LLM_CONFIG_PATH ?? path.join(configDir, "planb.yml");

const DEFAULT_CONFIG_PATH = IS_PRODUCTION
  ? ENV_CONFIG_PATH
  : path.join(path.dirname(path.dirname(__dirname)), "planb.yml");

// sync read config
export function loadConfig(configPath: string = DEFAULT_CONFIG_PATH) {
  const yamlContent = readFileSync(configPath, "utf-8");
  const parsed = load(yamlContent);

  const result = LLMConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new ConfigValidationError({
      configPath,
      originalContent: yamlContent,
      message: result.error.message,
      cause: result.error,
    });
  }

  return result.data;
}

const llmConfig = loadConfig(DEFAULT_CONFIG_PATH);
const agentsConfig = loadAgentsConfig();

// AI Client
export class AIClient {
  primaryModel: string;
  secondaryModel: string;
  provider: PlanbProvider;
  providersConfig: Record<string, Provider>;
  private _agents?: Record<string, Agent>;

  constructor(config: LLMConfig = llmConfig) {
    this.primaryModel = config.primaryModel;
    this.secondaryModel = config.secondaryModel ?? config.primaryModel;
    this.providersConfig = config.provider;
    this.provider = createPlanbCompatible(config.provider);
    this.createAgents();
  }
  get models() {
    return this.provider.models();
  }
  get agents() {
    if (this._agents) {
      return Object.keys(this._agents);
    } else {
      return [];
    }
  }

  private getModelId(model: LanguageModel) {
    if (model === "primary") {
      return this.primaryModel;
    } else if (model === "secondary") {
      return this.secondaryModel;
    }
    return model;
  }

  private async createAgents() {
    const configs = await agentsConfig;
    this._agents = configs.reduce<Record<string, Agent>>(
      (acc, [key, agentConfig]) => {
        const agent = new ToolLoopAgent({
          ...agentConfig,
          prepareCall: ({ model, ...options }) => {
            const modelId = this.getModelId(model);
            return {
              model: this.provider(modelId),
              ...options,
            };
          },
        });
        acc[key] = agent;
        return acc;
      },
      {},
    );
  }

  generate(
    agentId: AgentId,
    prompt: string | ModelMessage[],
    options: Omit<
      Parameters<ToolLoopAgent["generate"]>[0],
      "prompt" | "messages"
    > = {},
  ) {
    if (this._agents) {
      const agent = this._agents[agentId];
      if (agent) {
        return agent.generate({ prompt, ...options });
      } else {
        throw new AgentNotFoundError({ agent });
      }
    } else {
      throw new AgentUnInitialized();
    }
  }
}
