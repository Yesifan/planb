import path from "node:path";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { generateText } from "ai";

import { Provider, LLMConfigSchema, LLMConfig, PlanbProvider } from "./type";
import { createPlanbCompatible } from "./provider";
import { ConfigValidationError } from "./errors";

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

// AI Client
export class AIClient {
  primaryModel: string;
  secondaryModel: string;
  provider: PlanbProvider;
  providersConfig: Record<string, Provider>;

  constructor(config: LLMConfig = llmConfig) {
    this.primaryModel = config.primaryModel;
    this.secondaryModel = config.secondaryModel ?? config.primaryModel;
    this.provider = createPlanbCompatible(config.provider);
    this.providersConfig = config.provider;
  }

  get models() {
    return Object.entries(this.providersConfig).flatMap(([key, provider]) => {
      return Object.keys(provider.models).map((model) => `${key}/${model}`);
    });
  }

  generateText: typeof generateText = ({ model: modelArg, ...settings }) => {
    const model = this.provider(modelArg);

    return generateText({
      model: model,
      ...settings,
    });
  };
}
