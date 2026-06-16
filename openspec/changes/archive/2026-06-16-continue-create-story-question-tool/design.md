## Context

故事创建分为两段：首次 `createStory` 会让 Archivist 以 stream 方式运行，因此 `createQuestion` 工具调用会直接作为 UI message chunk 返回给前端；后续 `continueConversation` 在故事设定未完整时调用 `continueCreateStory`，但当前 `continueCreateStory` 使用 `archivist.generate()` 取得结果后无条件进入 Weaver。若 Archivist 在这一轮仍需要更多信息并调用 `createQuestion`，该工具调用不会先返回给前端等待用户回答。

现有约束是保持 `continueConversation` 对前端的返回形状不变，沿用 `StreamableValue<UIMessageChunk | AgentStatusEvent>`，并继续由 `saveMessageWithTool` 作为 assistant message 的唯一聚合写入点。用户对 question 的回答已保存在对应 `toolCall.result` 中；需要修复的是下一轮只读取最新一条 message 导致更早 question/tool result 没有进入 Archivist 上下文。

## Goals / Non-Goals

**Goals:**
- 在 `continueCreateStory` 中检测 Archivist 的 `createQuestion` 工具调用，并将 Archivist 结果返回给当前 stream。
- 当 Archivist 请求补充问题时停止本轮 Weaver 执行，让前端展示问题并等待用户再次回答。
- 在故事设定补全阶段，从最近 10 条聊天消息中筛选 `createQuestion` 相关 assistant message，并把已回答的 tool result 一并拼入 Archivist 上下文。
- 保持未请求问题时的现有 Archivist → Weaver 流程。
- 为新增分支补充行为测试，覆盖 tool call 持久化、stream 输出和不触发 Weaver 的行为。

**Non-Goals:**
- 不修改前端协议或新增 API endpoint。
- 不改变 `createQuestion` 工具 schema。
- 不重构多 Agent 编排架构或消息持久化策略。

## Decisions

1. **`continueCreateStory` 中 Archivist 统一使用 stream**
   - Decision: `continueCreateStory` 内的 Archivist 调用统一改为 `archivist.stream()`，不再使用 `archivist.generate()`。
   - Rationale: `continueConversation` 当前统一消费 `toUIMessageStream()`；`stream()` 结果天然支持该路径，也与首次 `createStory` 的 Archivist 行为一致。统一使用 stream 可以避免短路分支返回 `GenerateTextResult` 导致类型和运行时不匹配。
   - Alternative considered: 保留 `generate()` 并在 `continueConversation` 中为 `GenerateTextResult` 写手动 UI chunk 转换。该方式会制造两套输出协议，增加维护和测试成本。

2. **在 Archivist stream 结果后用 tool call 判断是否短路**
   - Decision: `continueCreateStory` 在 Archivist stream 完成并可读取 tool calls 后，检查非 dynamic tool calls 中是否存在 `createQuestion`。
   - Rationale: 这与 `continueStory` 中 Sentinel reject 分支的短路模式一致，能复用当前 UI stream 转换能力。
   - Alternative considered: 在工具执行层写入共享 flag。该方式耦合 tool context 和 action 分支，调试难度更高。

3. **短路时返回 Archivist stream result，而不是手动拼装 question payload**
   - Decision: 将 Archivist 的结果转成 UI message stream，由 `continueConversation` 现有循环输出给前端。
   - Rationale: 与首次 `createStory` 的工具调用展示路径一致，避免新增前端专用返回结构。
   - Alternative considered: 从 tool call input 中抽取 question 并返回自定义对象。该方式会破坏当前 action 返回形状。

4. **短路分支负责持久化 assistant message**
   - Decision: 当 Archivist 调用 `createQuestion` 时，通过传入的 `onFinish` 等价逻辑持久化本轮 assistant message 和 tool call；未短路时仍由 Weaver `onFinish` 统一写入。
   - Rationale: 一轮对话仍只写入一个 assistant message，符合现有 `saveMessageWithTool` 聚合约束。
   - Alternative considered: Archivist 和 Weaver 都分别写入消息。该方式会拆散一个 turn 的聚合数据并改变聊天历史语义。

5. **故事设定补全阶段拼接最近 10 条中的 question 上下文**
   - Decision: `continueConversation` 在故事设定未完成时查询最近 10 条 chat messages，筛选包含 `createQuestion` tool call 的 assistant message，并用 `toModelMessages()` 拼回 question tool call 与已保存的 tool result；当前正在回答的 latest question 必须用内存中已注入本轮 `prompt` 的 latest message 替换最近消息列表中的同 id message，再参与拼接。
   - Rationale: question/answer 的权威保存位置就是 `toolCall.result`；读取最近 10 条并筛选 question 消息能恢复多轮问答上下文，同时避免把无关聊天正文全部塞进 Archivist。
   - Alternative considered: 只读取 latest message。该方式会在 Q2/A2 之后丢失 Q1/A1 的上下文。读取全部消息会增加上下文体积且不符合当前“只补故事设定”的需求。

6. **question context 保持时间正序且不吞掉普通用户输入**
   - Decision: 最近 10 条消息筛选完成后必须按时间正序转换为 model messages；当 latest message 不是未回答 `createQuestion` 时，本轮 `prompt` 仍作为普通 user message 追加到 Archivist 输入。
   - Rationale: AI SDK tool-call conversation 需要按照 assistant tool-call → tool result 的历史顺序排列；普通继续输入不能被 question-context 筛选逻辑误删。
   - Alternative considered: 直接使用数据库倒序结果或只传 question context。前者会颠倒多轮问答，后者会丢失非 question 场景的当前用户意图。

## Risks / Trade-offs

- [Risk] `generate()` 结果没有 `toUIMessageStream()` 能力 → Mitigation: `continueCreateStory` 内 Archivist 统一使用 `stream()`，让短路与非短路都返回可被 `continueConversation` 消费的 stream result。
- [Risk] token usage 在短路与非短路分支重复累计或漏计 → Mitigation: 明确短路分支由 `onFinish` 持久化 Archivist usage，非短路分支仅累计 Archivist usage 后由 Weaver 完成写入。
- [Risk] 判断 tool call 名称时误包含 dynamic tool call → Mitigation: 沿用现有代码风格，仅匹配 `dynamic !== true` 且 `toolName === "createQuestion"`。
- [Risk] 最近 10 条不足以覆盖极端长问答链 → Mitigation: 当前按用户确认的范围实现；测试覆盖至少两轮 question/answer，后续如需要可扩展为配置项或查询未完成设定阶段的所有 question。
- [Risk] 测试中多轮相同 tool call 可能复用 mock toolCallId → Mitigation: 实现测试前让 mock provider 为 tool call 生成唯一 id，避免 `toolcall.id` 主键冲突掩盖真实行为。
