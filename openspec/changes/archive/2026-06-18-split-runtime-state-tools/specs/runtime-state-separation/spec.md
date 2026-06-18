## ADDED Requirements

### Requirement: Protagonist state is maintained independently from world snapshot
The system SHALL maintain protagonist profile, resources, and dimensions through protagonist-state tools that do not write the world snapshot.

#### Scenario: Archivist initializes protagonist state
- **WHEN** Archivist completes story setup initialization
- **THEN** it SHALL call `initializeProtagonistState` with `profile`, `resources`, and exactly five `dimensions`
- **AND** the system SHALL persist the protagonist state without writing `story.world_snapshot`

#### Scenario: Runtimekeeper updates protagonist state
- **WHEN** Runtimekeeper determines protagonist state changed after a story continuation
- **THEN** it SHALL call `updateProtagonistState` with the complete current `profile`, complete current `resources`, and five `dimensionValues`
- **AND** the system SHALL preserve existing dimension names and summaries while updating only their numeric values
- **AND** the system SHALL NOT require a world snapshot update in the same turn

### Requirement: Protagonist profile remains concise and non-overlapping
The system SHALL keep `profile` as a concise summary of the protagonist's current basic situation, without duplicating resource records or world snapshot details.

#### Scenario: Protagonist profile is initialized
- **WHEN** `initializeProtagonistState` is called
- **THEN** `profile` SHALL describe the protagonist's current basic condition, current time and place, current role or position, and a broad current-situation summary within 30 Chinese characters
- **AND** `profile` SHALL NOT include a resource list that belongs in `resources`
- **AND** `profile` SHALL NOT include detailed world-state background that belongs in `worldSnapshot`

#### Scenario: Protagonist profile is updated
- **WHEN** `updateProtagonistState` is called
- **THEN** the updated `profile` SHALL remain limited to the protagonist's current basic situation
- **AND** resource changes SHALL be represented in `resources`
- **AND** world-state changes SHALL be represented in `worldSnapshot`

### Requirement: Protagonist resources are stored as Markdown runtime state
The system SHALL store protagonist resources in `protagonist_state.resources` as nullable Markdown text, while protagonist-state tool inputs SHALL provide non-empty Markdown resources.

#### Scenario: New protagonist state includes resources
- **WHEN** `initializeProtagonistState` is called
- **THEN** the input SHALL include a non-empty `resources` Markdown string
- **AND** the system SHALL persist it to `protagonist_state.resources`

#### Scenario: Existing protagonist state has no resources value
- **WHEN** an existing protagonist state row has `resources` set to null
- **THEN** the system SHALL treat it as no recorded resources for context purposes
- **AND** the next protagonist-state tool write SHALL persist a non-empty Markdown resources value

#### Scenario: Resources template records available resources
- **WHEN** a protagonist has available resources
- **THEN** `resources` SHALL use a Markdown `## 可用资源` section
- **AND** each resource entry SHALL identify the resource and describe its current narrative value, with optional value and remarks lines

### Requirement: World snapshot is updated independently from protagonist state
The system SHALL update `story.world_snapshot` through a world-snapshot update tool that does not require protagonist state to exist or change.

#### Scenario: Runtimekeeper updates world snapshot only
- **WHEN** Runtimekeeper determines that story/world-state facts changed but protagonist state and task state do not need updates
- **THEN** it SHALL be able to call only `updateWorldSnapshot`
- **AND** the system SHALL persist the new `story.world_snapshot`

### Requirement: Runtimekeeper can maintain any subset of runtime state
The system SHALL allow Runtimekeeper to update protagonist state, world snapshot, task state, any combination of them, or none of them after a continuation turn.

#### Scenario: Runtimekeeper updates a subset of state domains
- **WHEN** only task progress changes after a story continuation
- **THEN** Runtimekeeper SHALL be able to call `updateTaskState` without also calling protagonist-state or world-snapshot tools

#### Scenario: Runtimekeeper performs no state update
- **WHEN** Runtimekeeper determines no runtime state needs to change
- **THEN** it SHALL be allowed to finish without calling a tool
- **AND** any natural-language text it produces SHALL be logged internally and SHALL NOT be shown to the user

### Requirement: Runtimekeeper can repair missing protagonist state as fallback
The system SHALL allow Runtimekeeper to initialize protagonist state only when the protagonist state is missing from an otherwise initialized story.

#### Scenario: Missing protagonist state fallback
- **WHEN** a story has completed story setup but lacks a `protagonist_state` row
- **THEN** Runtimekeeper SHALL be able to call `initializeProtagonistState`
- **AND** this fallback SHALL NOT replace Archivist's normal responsibility to initialize protagonist state during story setup
