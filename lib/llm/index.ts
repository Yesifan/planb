import path from "node:path";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { generateText } from "ai";

import { AIProvider, Provider, LLMConfigSchema } from "./type";
import { createAIProvider } from "./provider";

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
function loadConfig(configPath: string = DEFAULT_CONFIG_PATH) {
  const yamlContent = readFileSync(configPath, "utf-8");
  const parsed = load(yamlContent);

  const result = LLMConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`${configPath} formatter wrong:${result.error}`);
  }

  return result.data;
}

// AI Client
export class AIClient {
  primaryModel: string;
  secondaryModel: string;
  provider: Record<string, AIProvider>;
  providersConfig: Record<string, Provider>;

  constructor(configPath: string) {
    const config = loadConfig(configPath);
    this.primaryModel = config.primaryModel;
    this.secondaryModel = config.secondaryModel ?? config.primaryModel;
    this.provider = createAIProvider(config.provider);
    this.providersConfig = config.provider;
  }

  get modles() {
    return Object.entries(this.providersConfig).flatMap(([key, provider]) => {
      return Object.keys(provider.models).map((model) => `${key}/${model}`);
    });
  }

  generateText: typeof generateText = ({ model: modelArg, ...settings }) => {
    if (typeof modelArg === "string") {
      const [providerName, modelName] = modelArg.split("/");
      const provider = this.provider[providerName];
      const providerConfig = this.providersConfig[providerName];
      const model = providerConfig?.models[modelName];

      if (provider) {
        if (providerConfig.npm === "ai/test") {
          return generateText({
            model: provider("test"),
            ...settings,
          });
        } else if (model) {
          return generateText({
            model: provider(model.name),
            ...settings,
          });
        }
      }
    }
    return generateText({ model: modelArg, ...settings });
  };
}
