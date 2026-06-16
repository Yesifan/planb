## Why

当前 Agent 的 Markdown frontmatter 只能配置 `model`、`temperature`、`tools` 等基础参数，无法声明是否启用模型推理能力，也无法统一配置推理强度。为叙事系统中的不同 Agent 提供可配置的 reasoning 参数，可以让高复杂度 Agent 获得更强推理能力，同时让低成本或低延迟场景明确关闭该能力。

## What Changes

- 为 Agent 定义新增 `reasoning.enabled` 开关，用于启用或关闭该 Agent 的推理模式。
- 为 Agent 定义新增 `reasoning.effort` 参数，用于声明该 Agent 的推理强度。
- 在 Agent 创建链路中校验并传递新增配置，确保 Markdown 类型、运行时 schema 和 AI SDK 调用参数保持一致。
- 保持现有 Agent 默认行为不变：未显式配置 `reasoning` 的 Agent 继续按当前方式运行。
- 补充必要测试，覆盖配置解析、默认行为和 reasoning 开关对 effort 参数传递的影响。

## Capabilities

### New Capabilities
- `agent-reasoning-config`: Agent Markdown 配置可以通过 `reasoning.enabled` 控制是否启用推理模式，并通过 `reasoning.effort` 配置推理强度。

### Modified Capabilities

## Impact

- 影响 `planb/agents/*.md` 的 frontmatter 可用字段。
- 影响 `lib/llm/type.ts` 中 Agent schema/type。
- 影响 `lib/llm/agent.ts` 中 `createAgent` 的配置转换与透传逻辑。
- 可能影响 `types/markdown.d.ts` 对 Markdown frontmatter 的类型声明。
- 需要为配置解析与 Agent 创建行为增加或更新同目录单元测试。
