## ADDED Requirements

### Requirement: Agent reasoning fields are accepted in Markdown frontmatter
The system SHALL accept `reasoning.enabled` and `reasoning.effort` fields in Agent Markdown frontmatter and expose them through the Agent configuration type after validation.

#### Scenario: Agent defines reasoning configuration
- **WHEN** an Agent Markdown file contains valid `reasoning.enabled` and `reasoning.effort` frontmatter fields
- **THEN** the Agent schema validation SHALL accept the configuration and preserve those fields for Agent creation

#### Scenario: Agent omits reasoning configuration
- **WHEN** an Agent Markdown file omits `reasoning`
- **THEN** the Agent schema validation SHALL accept the configuration without changing the Agent's existing defaults

### Requirement: Reasoning enabled switch controls reasoning mode
The system SHALL use `reasoning.enabled` to decide whether an Agent enables, disables, or leaves reasoning mode unspecified.

#### Scenario: Reasoning is enabled
- **WHEN** an Agent has `reasoning.enabled: true`
- **THEN** Agent creation SHALL pass provider options that enable reasoning or thinking for supported providers

#### Scenario: Reasoning is disabled
- **WHEN** an Agent has `reasoning.enabled: false`
- **THEN** Agent creation SHALL pass provider options that disable reasoning or thinking where supported and SHALL NOT pass reasoning effort settings

#### Scenario: Reasoning enabled is omitted
- **WHEN** an Agent omits `reasoning.enabled`
- **THEN** Agent creation SHALL NOT add reasoning or thinking provider options unless `reasoning.effort` requires them

### Requirement: Reasoning parameters are mapped to AI SDK provider options
The system SHALL convert validated Agent `reasoning` parameters into AI SDK `providerOptions` during Agent creation.

#### Scenario: Reasoning effort is configured
- **WHEN** an Agent has a valid `reasoning.effort` value
- **THEN** Agent creation SHALL include the corresponding provider-specific reasoning effort option in the Agent settings

#### Scenario: Reasoning effort implies enabled reasoning
- **WHEN** an Agent has `reasoning.effort` and omits `reasoning.enabled`
- **THEN** Agent creation SHALL treat reasoning as enabled and include corresponding provider-specific reasoning options

#### Scenario: Disabled reasoning rejects effort
- **WHEN** an Agent has `reasoning.enabled: false` and a `reasoning.effort` value
- **THEN** Agent schema validation SHALL reject the configuration as contradictory

#### Scenario: Runtime options override frontmatter provider options
- **WHEN** Agent creation receives explicit runtime `providerOptions`
- **THEN** those runtime options SHALL take precedence over provider options derived from frontmatter

### Requirement: Existing Agents remain backward compatible
The system SHALL preserve current behavior for Agents that do not declare `reasoning`.

#### Scenario: Existing Agent config is unchanged
- **WHEN** an existing Agent Markdown file contains only previously supported frontmatter fields
- **THEN** Agent creation SHALL produce the same non-reasoning settings as before this change
