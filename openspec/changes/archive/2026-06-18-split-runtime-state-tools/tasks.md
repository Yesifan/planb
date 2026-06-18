## 1. 数据模型与迁移

- [x] 1.1 在 `lib/db/schema.ts` 为 `protagonist_state` 增加 nullable `resources` text 字段，并保持字段名统一为 `resources`
  - 已在 `protagonistState` 表中添加 `resources: text("resources")` 字段。
- [x] 1.2 新增 Drizzle migration，为现有数据库增加 nullable `protagonist_state.resources` 列
  - 已生成 `drizzle/20260618031150_add_protagonist_resources/migration.sql`，仅包含 `ALTER TABLE protagonist_state ADD resources text`。

## 2. Tool 契约与持久化逻辑

- [x] 2.1 先更新 `lib/llm/tool/state.test.ts`，覆盖 `initializeProtagonistState` 写入 `profile/resources/dimensions`、`profile` 不重复资源和世界快照职责、`updateProtagonistState` 保留维度名称/描述并更新数值、`updateWorldSnapshot` 独立写入世界快照
  - 测试已重写为 `state.test.ts`，覆盖 protagonist state 独立写入、维度保留、world snapshot 独立更新。
- [x] 2.2 调整 `createStory` schema、description 和实现，使其接收并保存 `worldSnapshot`
  - `CreateStorySchema` 新增 `worldSnapshot` 字段，`createStory` tool 持久化到 `story.world_snapshot`。
- [x] 2.3 将 `initializeStoryState` 替换为 `initializeProtagonistState`，输入为 `profile/resources/dimensions`
  - 新 tool 写入 `profile/resources/dimensions` 到 `protagonist_state`，不操作 `story.world_snapshot`。
- [x] 2.4 将 `updateStoryState` 拆为 `updateProtagonistState` 和 `updateWorldSnapshot`
  - `updateProtagonistState` 更新 `profile/resources/dimensionValues`；`updateWorldSnapshot` 单独更新 `story.world_snapshot`。
- [x] 2.5 更新 tool 聚合导出、tool name 类型和 agent tool typing，移除旧 story-state tool 名并注册新工具
  - `lib/llm/tool/index.ts`、`lib/llm/index.ts` 已更新为新工具名，旧 `initializeStoryState`/`updateStoryState` 已移除。

## 3. Agent Prompt 与流程编排

- [x] 3.1 更新 `planb/agents/Archivist.md`，要求 `createStory` 保存初始世界快照，并将初始化工具顺序/名称调整为 `initializeProtagonistState`、`initializeTaskState`、`createStory`
  - Archivist prompt 已更新为 `createStory → initializeProtagonistState → initializeTaskState` 顺序。
- [x] 3.2 更新 `planb/agents/Runtimekeeper.md`，说明主角状态、世界快照、任务状态可按需独立维护，主角初始化仅作为缺失状态保底
  - Runtimekeeper prompt 已更新，明确可按需调用任意子集，无变化时可自然结束。
- [x] 3.3 更新 `lib/llm/archivist-init.ts`，将初始化完成门控改为 `createStory + initializeProtagonistState + initializeTaskState`
  - 门控工具列表已替换。
- [x] 3.4 更新 `lib/actions/llm.ts` 中 Runtimekeeper 调用逻辑，允许无工具调用自然结束，并将 Runtimekeeper 普通文本输出仅记录日志、不展示给用户
  - 移除了强制要求 story-state + task-state 的 `stopWhen`，prompt 改为按需维护，文本输出写入日志。

## 4. 集成测试与回归验证

- [x] 4.1 更新 `lib/llm/archivist-init.test.ts`，覆盖新的三件套门控和缺失工具错误信息
  - 测试已更新为新工具名。
- [x] 4.2 更新 `lib/actions/llm.test.ts` fixture 和断言，覆盖 `createStory.worldSnapshot` 持久化、新 protagonist state 工具、Runtimekeeper 按需更新和无工具调用行为
  - fixture 和测试已更新，新增无工具调用、仅任务更新、主角状态保底等用例。
- [x] 4.3 更新受影响的上下文拼接测试，确保 nullable `resources` 在旧数据下不会破坏 agent context
  - `lib/llm/utils.test.ts` 新增 resources 存在与为 null 两种场景的断言。
- [x] 4.4 运行 `bun lint --fix` 并修复格式/静态检查问题
  - 已运行 `bun lint --fix`，无 lint error；保留既有 `lib/llm/tool/agent.ts` 未使用 import warning。
- [x] 4.5 运行 `bunx tsc --noEmit` 并修复类型错误
  - 已运行 `bunx tsc --noEmit`，通过。
- [x] 4.6 运行相关 bun 单元测试并修复失败用例
  - 已运行 `bun test lib/llm/tool/state.test.ts lib/llm/archivist-init.test.ts lib/llm/utils.test.ts lib/actions/llm.test.ts`，31 个测试通过。
