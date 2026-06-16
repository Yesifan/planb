const REQUIRED_ARCHIVIST_INIT_TOOLS = [
  "createStory",
  "initializeStoryState",
  "initializeTaskState",
] as const;

type ArchivistStep = {
  toolResults: readonly { toolName: string; dynamic?: boolean }[];
};

/**
 * Check whether all required Archivist initialization tools have been
 * successfully called across the given steps. Used as a `stopWhen`
 * condition to keep the agent running until init is complete.
 */
export function isArchivistInitComplete(steps: readonly ArchivistStep[]) {
  const completedToolNames = new Set(
    steps
      .flatMap((step) => step.toolResults)
      .filter((result) => result.dynamic !== true)
      .map((result) => result.toolName),
  );
  return REQUIRED_ARCHIVIST_INIT_TOOLS.every((toolName) =>
    completedToolNames.has(toolName),
  );
}

/**
 * Return the names of required init tools that are not in the completed set.
 * Used for error reporting when the agent finishes without completing init.
 */
export function missingInitToolNames(completedToolNames: Set<string>) {
  return REQUIRED_ARCHIVIST_INIT_TOOLS.filter(
    (toolName) => !completedToolNames.has(toolName),
  );
}