import type { ModelMessage } from "ai";

function estimateTextTokens(text: string) {
  const chars = [...text];
  const cjkTokens = chars.filter((char) =>
    /[\u3400-\u9fff\uf900-\ufaff]/u.test(char),
  ).length;
  const nonCjkCharacters = chars.filter(
    (char) => !/[\u3400-\u9fff\uf900-\ufaff]|\s/u.test(char),
  ).length;

  return cjkTokens + Math.ceil(nonCjkCharacters / 4);
}

function estimateJsonTokens(value: unknown) {
  return estimateTextTokens(JSON.stringify(value) ?? "");
}

function estimateContentTokens(content: ModelMessage["content"]) {
  if (typeof content === "string") {
    return estimateTextTokens(content);
  }

  return content.reduce((sum, part) => {
    if (part.type === "text") {
      return sum + estimateTextTokens(part.text);
    }
    if (part.type === "tool-call") {
      return (
        sum + 1 + estimateTextTokens(part.toolName) + estimateJsonTokens(part.input)
      );
    }
    if (part.type === "tool-result") {
      return (
        sum + 1 + estimateTextTokens(part.toolName) + estimateJsonTokens(part.output)
      );
    }
    return sum + estimateJsonTokens(part);
  }, 0);
}

export function estimateModelMessageTokens(
  messages: Array<ModelMessage | undefined>,
) {
  return messages.reduce(
    (sum, message) =>
      sum + (message ? 1 + estimateContentTokens(message.content) : 0),
    0,
  );
}
