## Why

`continueCreateStory` 仍处于故事设定补全阶段时，Archivist 可能再次调用 `createQuestion` 工具要求用户补充信息。当前流程会继续进入 Weaver 生成故事，导致前端无法像首次 `createStory` 一样展示问题并等待回答。

## What Changes

- 当 `continueCreateStory` 中的 Archivist 调用 `createQuestion` 时，系统 SHALL 将该工具调用对应的 UI stream 返回给前端。
- 前端回答问题后，仍通过现有 `continueConversation` 入口再次触发 `continueCreateStory`，直到故事设定完整后再进入 Weaver。
- 在故事设定补全阶段，`continueConversation` SHALL 从最近 10 条聊天消息中筛选 `createQuestion` 相关 assistant message，并把这些 question/tool result 拼入下一轮 Archivist 上下文，避免多轮提问时前序答案丢失。
- 当 Archivist 未请求补充问题时，现有 Archivist → Weaver 的补全故事流程保持不变。
- 保留 assistant message 持久化、tool call 记录和 token usage 聚合语义。

## Capabilities

### New Capabilities
- `story-creation-continuation`: Covers continuation behavior while an initial story is still collecting worldbuilding information.

### Modified Capabilities

## Impact

- Affected server action: `lib/actions/llm.ts` (`continueCreateStory` / `continueConversation`).
- Affected tests: `lib/actions/llm.test.ts` continuation setup and streaming assertions.
- No new dependencies or breaking API changes expected.
