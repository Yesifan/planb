import { AISDKError } from 'ai';

const name = 'AI_ConfigValidationError';
const marker = `vercel.ai.error.${name}`;
const symbol = Symbol.for(marker);

/**
 * 配置验证错误，当 YAML 配置格式不正确时抛出
 * 继承自 AISDKError 以保持与 AI SDK 错误体系一致性
 */
export class ConfigValidationError extends AISDKError {
  private readonly [symbol] = true; // used in isInstance

  /** 配置文件路径 */
  readonly configPath: string;
  /** 原始配置内容 */
  readonly originalContent: string;

  constructor({
    configPath,
    originalContent,
    message,
    cause,
  }: {
    configPath: string;
    originalContent: string;
    message: string;
    cause?: unknown;
  }) {
    super({
      name,
      message: `Config validation failed at ${configPath}: ${message}`,
      cause,
    });

    this.configPath = configPath;
    this.originalContent = originalContent;
  }

  static isInstance(error: unknown): error is ConfigValidationError {
    return AISDKError.hasMarker(error, marker);
  }
}
