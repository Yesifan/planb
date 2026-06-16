## ADDED Requirements

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
