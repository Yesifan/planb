## 1. 纯函数与工具模块（TDD）

- [x] 1.1 创建 `lib/llm/archivist-init.ts`：提取 `isArchivistInitComplete`、`missingInitToolNames` 纯函数（从 `lib/actions/archivist-init-retry.ts` 迁移并精简）
- [x] 1.2 创建 `lib/llm/archivist-init.test.ts`：覆盖完整性检查与缺失工具计算的边界用例
- [x] 1.3 创建 `lib/llm/repair-tool-call.ts`：实现 `createRepairToolCall` 工厂函数，使用 `generateText` + `Output.object({ schema })` 修复无效 JSON 工具参数
- [x] 1.4 创建 `lib/llm/repair-tool-call.test.ts`：覆盖修复成功、修复失败返回 null、未知工具返回 null 的边界用例

## 2. Agent 工厂注入修复能力

- [x] 2.1 更新 `lib/llm/agent.ts` 的 `createAgent` 函数：解析 model 后自动注入 `experimental_repairToolCall`（使用 `createRepairToolCall(model)`）
- [x] 2.2 确保 `options.experimental_repairToolCall` 优先于默认修复函数（如果调用方提供了自定义修复函数）

## 3. continueCreateStory 编排重写

- [x] 3.1 移除 `continueCreateStory` 中的手动重试循环（`for attempt` 循环、`completedToolNames` 累积、`responseMessages` 累积、`invalidToolCalls` 追踪、重试提示构造）
- [x] 3.2 更新 `stopWhen` 条件：使用 `isArchivistInitComplete` 替代 `hasToolCall("createStory")` 和 `hasInvalidRequiredInitToolCall`
- [x] 3.3 添加完成后验证：agent 结束后检查所有必需工具是否已完成，缺失则抛出错误
- [x] 3.4 保持 `createQuestion` 短路逻辑不变
- [x] 3.5 保持 Weaver 接续流程不变（使用 `archivistResult.response.messages` 作为上下文）

## 4. 清理与迁移

- [x] 4.1 删除 `lib/actions/archivist-init-retry.ts`（已迁移至 `lib/llm/archivist-init.ts`）
- [x] 4.2 更新 `lib/actions/llm.ts` 的 import 路径（从 `./archivist-init-retry` 改为 `@/lib/llm/archivist-init`）

## 5. 测试更新

- [x] 5.1 移除 `lib/actions/llm.test.ts` 中的手动重试循环测试（4 个测试）
- [x] 5.2 添加基于完整性 `stopWhen` 的集成测试：agent 持续运行直到所有必需工具完成
- [x] 5.3 添加 `experimental_repairToolCall` 修复无效 JSON 的集成测试
- [x] 5.4 添加缺失工具错误的集成测试：agent 达到 maxSteps 仍缺失 → 抛错
- [x] 5.5 保持 `createQuestion` 短路测试不变

## 6. 验证与回归

- [x] 6.1 运行所有 co-located 单元测试并确认通过
- [x] 6.2 运行 `bun lint --fix`
- [x] 6.3 运行 `bunx tsc --noEmit`
- [x] 6.4 若本次实现直接覆盖根目录 `TODO.md` 中某项功能，按项目规则更新对应条目
