import { AISDKError } from "ai";

const CONFIG_VALIDATION_NAME = "AI_ConfigValidationError";
const CONFIG_VALIDATION_MARKER = `vercel.ai.error.${CONFIG_VALIDATION_NAME}`;
const configValidationSymbol = Symbol.for(CONFIG_VALIDATION_MARKER);

export class ConfigValidationError extends AISDKError {
  private readonly [configValidationSymbol] = true;

  readonly configPath: string;
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
      name: CONFIG_VALIDATION_NAME,
      message: `Config validation failed at ${configPath}: ${message}`,
      cause,
    });

    this.configPath = configPath;
    this.originalContent = originalContent;
  }

  static isInstance(error: unknown): error is ConfigValidationError {
    return AISDKError.hasMarker(error, CONFIG_VALIDATION_MARKER);
  }
}

const AGENT_UNINITIALIZED_NAME = "AI_AgentUnInitialized";
const AGENT_UNINITIALIZED_MARKER = `vercel.ai.error.${AGENT_UNINITIALIZED_NAME}`;
const agentUninitializedSymbol = Symbol.for(AGENT_UNINITIALIZED_MARKER);

export class AgentUnInitialized extends AISDKError {
  private readonly [agentUninitializedSymbol] = true;

  constructor() {
    super({
      name: AGENT_UNINITIALIZED_NAME,
      message: `The agent has not been initialized.`,
    });
  }

  static isInstance(error: unknown): error is AgentUnInitialized {
    return AISDKError.hasMarker(error, AGENT_UNINITIALIZED_MARKER);
  }
}

const AGENT_NOT_FOUND_NAME = "AI_AgentNotFoundError";
const AGENT_NOT_FOUND_MARKER = `vercel.ai.error.${AGENT_NOT_FOUND_NAME}`;
const agentNotFoundSymbol = Symbol.for(AGENT_NOT_FOUND_MARKER);

export class AgentNotFoundError extends AISDKError {
  private readonly [agentNotFoundSymbol] = true;

  constructor({ agent }: { agent: string }) {
    super({
      name: AGENT_NOT_FOUND_NAME,
      message: `${agent} not found`,
    });
  }

  static isInstance(error: unknown): error is AgentNotFoundError {
    return AISDKError.hasMarker(error, AGENT_NOT_FOUND_MARKER);
  }
}

const INVALID_INPUT_NAME = "AI_InvalidInputError";
const INVALID_INPUT_MARKER = `vercel.ai.error.${INVALID_INPUT_NAME}`;
const invalidInputSymbol = Symbol.for(INVALID_INPUT_MARKER);

export class InvalidInputError extends AISDKError {
  private readonly [invalidInputSymbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name: INVALID_INPUT_NAME, message, cause });
  }

  static isInstance(error: unknown): error is InvalidInputError {
    return AISDKError.hasMarker(error, INVALID_INPUT_MARKER);
  }
}

const MESSAGE_NOT_FOUND_NAME = "AI_MessageNotFoundError";
const MESSAGE_NOT_FOUND_MARKER = `vercel.ai.error.${MESSAGE_NOT_FOUND_NAME}`;
const messageNotFoundSymbol = Symbol.for(MESSAGE_NOT_FOUND_MARKER);

export class MessageNotFoundError extends AISDKError {
  private readonly [messageNotFoundSymbol] = true;

  readonly chatId?: string;

  constructor({
    message,
    chatId,
    cause,
  }: {
    message: string;
    chatId?: string;
    cause?: unknown;
  }) {
    super({ name: MESSAGE_NOT_FOUND_NAME, message, cause });
    this.chatId = chatId;
  }

  static isInstance(error: unknown): error is MessageNotFoundError {
    return AISDKError.hasMarker(error, MESSAGE_NOT_FOUND_MARKER);
  }
}

const INVALID_STATE_NAME = "AI_InvalidStateError";
const INVALID_STATE_MARKER = `vercel.ai.error.${INVALID_STATE_NAME}`;
const invalidStateSymbol = Symbol.for(INVALID_STATE_MARKER);

export class InvalidStateError extends AISDKError {
  private readonly [invalidStateSymbol] = true;

  constructor({ message, cause }: { message: string; cause?: unknown }) {
    super({ name: INVALID_STATE_NAME, message, cause });
  }

  static isInstance(error: unknown): error is InvalidStateError {
    return AISDKError.hasMarker(error, INVALID_STATE_MARKER);
  }
}

const ACCESS_DENIED_NAME = "AI_AccessDeniedError";
const ACCESS_DENIED_MARKER = `vercel.ai.error.${ACCESS_DENIED_NAME}`;
const accessDeniedSymbol = Symbol.for(ACCESS_DENIED_MARKER);

export class AccessDeniedError extends AISDKError {
  private readonly [accessDeniedSymbol] = true;

  readonly resource: string;
  readonly resourceId?: string;

  constructor({
    resource,
    resourceId,
    message,
    cause,
  }: {
    resource: string;
    resourceId?: string;
    message?: string;
    cause?: unknown;
  }) {
    super({
      name: ACCESS_DENIED_NAME,
      message:
        message ??
        (resourceId
          ? `Access denied to ${resource} ${resourceId}`
          : `Access denied to ${resource}`),
      cause,
    });
    this.resource = resource;
    this.resourceId = resourceId;
  }

  static isInstance(error: unknown): error is AccessDeniedError {
    return AISDKError.hasMarker(error, ACCESS_DENIED_MARKER);
  }
}
