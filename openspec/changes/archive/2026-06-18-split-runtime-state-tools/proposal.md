## Why

当前运行状态工具把主角 profile、五维状态和 worldSnapshot 绑定在同一个初始化/更新工具里，导致主角状态与世界态势无法按各自职责独立维护。资源信息也混在 profile 文本中，容易和主角概况重复、遗漏或更新不一致。

## What Changes

- **BREAKING** 调整故事创建工具契约：`createStory` 保存故事标题、类型、世界观和初始世界快照。
- **BREAKING** 拆分现有 `initializeStoryState` / `updateStoryState`：主角状态和世界快照分别由独立工具维护。
- 新增 `protagonist_state.resources` 持久化字段，用 Markdown 模板记录主角可用资源。
- Archivist 正常初始化时必须完成 `createStory`、`initializeProtagonistState`、`initializeTaskState`。
- Runtimekeeper 后续维护时可按需更新主角状态、世界快照或任务状态，也允许不调用工具自然结束；普通文本仅用于日志，不展示给用户。
- 更新相关测试，覆盖新工具契约、初始化门控、持久化字段和 Runtimekeeper 无工具调用行为。

## Capabilities

### New Capabilities
- `runtime-state-separation`: 运行状态拆分、主角资源记录、初始化门控和 Runtimekeeper 按需维护行为。

### Modified Capabilities
- `story-creation-continuation`: 故事创建流程需要把初始 worldSnapshot 纳入 `createStory`，并调整 Archivist/Runtimekeeper 的状态维护契约。

## Impact

- 影响 LLM tool schema、tool 实现和工具注册：`lib/llm/tool/story.ts`、`lib/llm/tool/state.ts`、`lib/llm/tool/index.ts`、`lib/llm/index.ts`。
- 影响数据库 schema 与迁移：`lib/db/schema.ts`、`drizzle/`。
- 影响 Archivist/Runtimekeeper agent prompt：`planb/agents/Archivist.md`、`planb/agents/Runtimekeeper.md`。
- 影响初始化完成判断和续写编排：`lib/llm/archivist-init.ts`、`lib/actions/llm.ts`。
- 影响测试 fixture 与断言：`lib/llm/tool/state.test.ts`、`lib/llm/archivist-init.test.ts`、`lib/actions/llm.test.ts`。
