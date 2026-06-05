# TODO

- [ ] 切换chat时 streamingstatus 未重置
- [x] 没有retry
- [ ] 没有 copy
- [ ] 主角五维系统
- [ ] 世界当前快照系统
- [ ] 任务系统
- [x] 发送message后输入框清空
  - 参考 AI Elements Prompt Input 示例，在 `components/story-prompt.tsx` 使用 React state 控制输入框，提交时立即清空本地 `text`，不修改通用 `PromptInputProvider` 行为。
- [ ] token 记录和显示
  - 记录部分已完成：
    - 在 `lib/llm/type.ts` 的 `ToolContext` 增加 `tokenUsage?: { inputTokens, outputTokens }` 字段
    - 新增 `lib/llm/usage.ts` 提供 `createTokenAccumulator()` / `addUsage()` 纯函数（co-located 单元测试）
    - 利用 AI SDK 的 `experimental_context` 在 turn 内透传同一个累加器对象，sub-agent 自动共享
    - 各 agent 触点累加：`lib/llm/tool/agent.ts` 三个 tool（activateSystem/exMachina/reviewBranch）generate 后 addUsage；`lib/actions/llm.ts` Oracle stream 的 onFinish 与 Archivist generate 后 addUsage
    - 在 `lib/llm/db.ts:saveMessageWithTool` 一处持久化到 message 行的 inputTokens/outputTokens（一次 turn 只调用一次，是聚合写入的唯一点）
    - 三入口（createStory / continueCreateStory / continueStory）调用代码保持一致：仅在构造 ctx 时多传 `tokenUsage: createTokenAccumulator()`
  - 显示部分待办：前端聊天界面尚未读取并展示每条 assistant message 的 inputTokens/outputTokens
