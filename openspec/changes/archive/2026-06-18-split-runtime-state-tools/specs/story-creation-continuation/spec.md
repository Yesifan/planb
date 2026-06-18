## MODIFIED Requirements

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
