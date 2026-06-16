## Why

`continueCreateStory` 依赖 Archivist 在故事初始化阶段完整调用 `createStory`、`initializeTaskState`、`initializeStoryState` 三个工具；如果任一工具缺失，后续故事生成会在不完整状态下继续，造成初始化数据缺失或流程卡住。

同时，Archivist 工具调用可能因模型输出了无效 JSON 参数而失败（`AI_InvalidToolInputError` / `AI_JSONParseError`）；这类可恢复失败需要就地修复，而不是重新运行整个 agent。

## What Changes

- 使用 AI SDK 的 `experimental_repairToolCall` 在工具调用参数无效时就地修复 JSON，无需重新运行整个 Archivist agent。
- 使用基于完整性的 `stopWhen` 条件，让 Archivist 持续运行直到所有必需初始化工具均已成功调用，而不是在 `createStory` 被调用后立即停止。
- 移除手动重试循环（`for attempt` 循环、重试提示构造、跨轮次状态累积），改为单次 agent 调用 + 多步骤模式。
- 在 `createAgent` 工厂中默认注入 `experimental_repairToolCall`，使所有 agent 自动获得 JSON 修复能力。
- 将 archivist 初始化工具函数从 `lib/actions/` 移至 `lib/llm/`，因为 `actions` 目录专用于 Next.js server action API。
- 保持现有 `createQuestion` 追问流程与 Weaver 接续流程不被破坏。

## Capabilities

### New Capabilities

- `tool-call-repair`: 通用工具调用修复函数，使用 `experimental_repairToolCall` 在工具参数无效时就地修复。

### Modified Capabilities

- `story-creation-continuation`: 从手动重试循环改为 `experimental_repairToolCall` + 完整性 `stopWhen` + 完成后验证的三层防御方案。

## Impact

- 影响 `continueCreateStory` 中 Archivist 调用方式、`stopWhen` 条件、错误处理。
- 影响 `createAgent` 工厂，默认注入 `experimental_repairToolCall`。
- 新增 `lib/llm/repair-tool-call.ts` 和 `lib/llm/archivist-init.ts`。
- 删除 `lib/actions/archivist-init-retry.ts`。
- 需要覆盖完整性 `stopWhen`、`experimental_repairToolCall` 修复、缺失工具错误、`createQuestion` 短路的行为测试。
- 不引入新的外部依赖；不改变前端 API 形态。
