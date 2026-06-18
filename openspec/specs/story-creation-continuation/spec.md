## Purpose

Define how incomplete story setup continues across multiple user answers, including follow-up Archivist questions and preservation of prior question/answer context.

## Requirements

### Requirement: Continuation can request more story setup answers
The system SHALL return Archivist `createQuestion` tool calls to the frontend when continuing an incomplete story setup.

#### Scenario: Archivist asks another question during story setup continuation
- **WHEN** a user answers a prior setup question and the story setup is still incomplete
- **AND** Archivist calls `createQuestion` during `continueCreateStory`
- **THEN** the system SHALL stream the `createQuestion` tool call back to the frontend
- **AND** the system SHALL persist the assistant message with the tool call
- **AND** the system SHALL NOT run Weaver in the same turn

#### Scenario: User answers the follow-up question
- **WHEN** the frontend submits the user's answer through the existing continue conversation action
- **THEN** the system SHALL process the answer through `continueCreateStory` again while the story setup remains incomplete

#### Scenario: Multiple setup questions preserve previous answers
- **WHEN** the user answers a second `createQuestion` prompt during incomplete story setup
- **THEN** the system SHALL include prior `createQuestion` tool calls and their saved `toolCall.result` answers from the recent question context in the next Archivist prompt
- **AND** the system SHALL include the current answer as the result for the latest question before invoking Archivist

#### Scenario: Question context is limited to recent relevant messages
- **WHEN** the system builds Archivist context during incomplete story setup
- **THEN** the system SHALL inspect the 10 most recent chat messages
- **AND** the system SHALL include assistant messages that contain `createQuestion` tool calls
- **AND** the system SHALL exclude messages that do not contain `createQuestion` tool calls from this question-context slice

### Requirement: Continuation proceeds to story generation when no more questions are needed
The system SHALL keep the existing Archivist-to-Weaver flow when Archivist does not request more setup information.

#### Scenario: Archivist completes setup continuation without asking a question
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist completes without calling `createQuestion`
- **THEN** the system SHALL run Weaver to generate the story opening
- **AND** the system SHALL stream Weaver output to the frontend
- **AND** the system SHALL persist a single assistant message for the turn

### Requirement: Continuation ensures complete Archivist initialization
The system SHALL verify that Archivist has successfully completed all required story initialization tools before continuing from setup to story generation. The required tools are `createStory`, `initializeTaskState`, and `initializeProtagonistState`. The `createStory` tool SHALL save the story title, type, worldview, and initial world snapshot.

#### Scenario: Archivist omits one required initialization tool
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist does not call `createQuestion`
- **AND** Archivist successfully calls `createStory` and `initializeTaskState` but does not successfully call `initializeProtagonistState`
- **THEN** the system SHALL keep Archivist running via the completeness-based `stopWhen` condition
- **AND** Archivist SHALL continue executing steps until `initializeProtagonistState` is successfully called
- **AND** the system SHALL NOT stop solely because `createStory` was called

#### Scenario: Archivist omits multiple required initialization tools
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist does not call `createQuestion`
- **AND** Archivist completes without successfully calling two or more required initialization tools
- **THEN** the system SHALL keep Archivist running via the completeness-based `stopWhen` condition
- **AND** Archivist SHALL continue executing steps until all missing required initialization tools are successfully called

#### Scenario: Archivist completes all required initialization tools
- **WHEN** Archivist successfully completes all required initialization tools (`createStory`, `initializeTaskState`, `initializeProtagonistState`)
- **THEN** the completeness-based `stopWhen` condition SHALL return true
- **AND** the system SHALL proceed with the existing Weaver story generation flow
- **AND** the system SHALL stream Weaver output to the frontend
- **AND** the system SHALL persist a single assistant message for the turn

#### Scenario: Archivist asks a follow-up question instead of initializing
- **WHEN** a user continues an incomplete story setup
- **AND** Archivist calls `createQuestion`
- **THEN** the system SHALL return the question to the frontend using the existing follow-up question flow
- **AND** the system SHALL NOT retry solely because `createStory`, `initializeTaskState`, or `initializeProtagonistState` were not called in that turn
- **AND** the system SHALL NOT run Weaver in the same turn

#### Scenario: Required initialization tools remain missing after max steps
- **WHEN** Archivist still has not successfully completed every required initialization tool after reaching the configured step limit (`stepCountIs(20)`)
- **THEN** the system SHALL fail the continuation with an explicit error
- **AND** the error SHALL identify the required initialization tools that remain missing

#### Scenario: CreateStory saves initial world snapshot
- **WHEN** Archivist calls `createStory` during story setup initialization
- **THEN** the tool input SHALL include a non-empty `worldSnapshot`
- **AND** the system SHALL persist it as `story.world_snapshot`

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
