## ADDED Requirements

### Requirement: Continuation ensures complete Archivist initialization
The system SHALL verify that Archivist has successfully completed all required story initialization tools before continuing from setup to story generation. The required tools are `createStory`, `initializeTaskState`, and `initializeStoryState`.

#### Scenario: Archivist omits one required initialization tool
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist does not call `createQuestion`
- **AND** Archivist successfully calls `createStory` and `initializeTaskState` but does not successfully call `initializeStoryState`
- **THEN** the system SHALL keep Archivist running via the completeness-based `stopWhen` condition
- **AND** Archivist SHALL continue executing steps until `initializeStoryState` is successfully called
- **AND** the system SHALL NOT stop solely because `createStory` was called

#### Scenario: Archivist omits multiple required initialization tools
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist does not call `createQuestion`
- **AND** Archivist completes without successfully calling two or more required initialization tools
- **THEN** the system SHALL keep Archivist running via the completeness-based `stopWhen` condition
- **AND** Archivist SHALL continue executing steps until all missing required initialization tools are successfully called

#### Scenario: Archivist completes all required initialization tools
- **WHEN** Archivist successfully completes all required initialization tools (`createStory`, `initializeTaskState`, `initializeStoryState`)
- **THEN** the completeness-based `stopWhen` condition SHALL return true
- **AND** the system SHALL proceed with the existing Weaver story generation flow
- **AND** the system SHALL stream Weaver output to the frontend
- **AND** the system SHALL persist a single assistant message for the turn

#### Scenario: Archivist asks a follow-up question instead of initializing
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist calls `createQuestion`
- **THEN** the system SHALL return the question to the frontend using the existing follow-up question flow
- **AND** the system SHALL NOT retry solely because `createStory`, `initializeTaskState`, or `initializeStoryState` were not called in that turn
- **AND** the system SHALL NOT run Weaver in the same turn

#### Scenario: Required initialization tools remain missing after max steps
- **WHEN** Archivist still has not successfully completed every required initialization tool after reaching the configured step limit (`stepCountIs(20)`)
- **THEN** the system SHALL fail the continuation with an explicit error
- **AND** the error SHALL identify the required initialization tools that remain missing

### Requirement: Continuation repairs invalid Archivist tool input in-place
The system SHALL use `experimental_repairToolCall` to repair invalid tool call parameters in-place when Archivist generates tool calls with parameters that fail schema validation.

#### Scenario: Archivist emits invalid JSON for a required tool input
- **WHEN** Archivist attempts to call a required initialization tool
- **AND** the tool call fails with `AI_InvalidToolInputError` caused by `AI_JSONParseError`
- **THEN** the system SHALL invoke `experimental_repairToolCall` to repair the tool call parameters in-place
- **AND** the repair function SHALL use `generateText` with `Output.object({ schema })` to generate valid parameters
- **AND** the repaired tool call SHALL be executed without re-running the entire Archivist agent

#### Scenario: Archivist fixes invalid tool input via repair
- **WHEN** Archivist previously failed a required initialization tool because of invalid JSON input
- **AND** `experimental_repairToolCall` successfully repairs the tool call parameters
- **AND** all other required initialization tools are successfully completed
- **THEN** the system SHALL proceed with the existing Weaver story generation flow

#### Scenario: Repair function fails to fix invalid tool input
- **WHEN** `experimental_repairToolCall` fails to repair a tool call (returns `null`)
- **THEN** the system SHALL let the error propagate through normal AI SDK error handling
- **AND** the agent SHALL continue executing steps (the error is included in the next step's messages)

#### Scenario: Archivist hits a non-recoverable tool failure
- **WHEN** Archivist fails a tool call for a reason other than a recoverable invalid input error
- **THEN** the system SHALL NOT attempt to repair it via `experimental_repairToolCall`
- **AND** the system SHALL surface the failure through the existing error path

### Requirement: All agents have tool call repair capability by default
The system SHALL inject `experimental_repairToolCall` into all agents created via `createAgent` factory, providing automatic JSON repair capability without per-agent configuration.

#### Scenario: Agent created without custom repair function
- **WHEN** an agent is created via `createAgent` without providing a custom `experimental_repairToolCall`
- **THEN** the system SHALL inject a default repair function that uses the agent's model
- **AND** the repair function SHALL be available for all tool calls made by the agent

#### Scenario: Agent created with custom repair function
- **WHEN** an agent is created via `createAgent` with a custom `experimental_repairToolCall`
- **THEN** the system SHALL use the provided custom repair function
- **AND** the system SHALL NOT inject the default repair function
