## Context

`continueCreateStory` 在故事初始化尚未完成时会调用 Archivist。Archivist 可能继续追问，也可能通过工具产出完整初始化结果，然后交给 Weaver 生成开篇。当前风险点是：初始化成功的判断如果只依赖 Archivist 结束，而不验证必需工具是否全部成功调用，就会让缺失的 `createStory`、`initializeTaskState` 或 `initializeStoryState` 被静默跳过。

另一个风险点是工具参数由模型生成，可能出现可恢复的结构化输出失败。例如失败日志包含 `dynamic: true`、`invalid: true`，错误名为 `AI_InvalidToolInputError`，其 cause 为 `AI_JSONParseError`。这代表模型尝试调用工具但输入 JSON 无法解析。

旧方案使用手动重试循环（`for attempt` 循环 + 重试提示构造 + 跨轮次状态累积），每次重试都重新运行整个 Archivist agent，浪费 token 和时间。新方案使用 AI SDK 原生能力替代手动编排。

## Goals / Non-Goals

**Goals:**

- 在 `continueCreateStory` 中保证 Archivist 完成初始化前，`createStory`、`initializeTaskState`、`initializeStoryState` 三个必需工具均已成功调用。
- 对无效 JSON 工具参数使用 `experimental_repairToolCall` 就地修复，无需重新运行整个 agent。
- 使用基于完整性的 `stopWhen` 条件让 agent 持续运行直到所有必需工具完成，而不是在 `createStory` 被调用后立即停止。
- 在 `createAgent` 工厂中默认注入 `experimental_repairToolCall`，使所有 agent 自动获得 JSON 修复能力。
- 保持现有追问问题、消息持久化、token 使用累计与 Weaver 接续行为一致。

**Non-Goals:**

- 不改变 Archivist、Weaver 的职责划分。
- 不改变前端提交答案或接收流式响应的 API。
- 不引入新的队列、后台任务或外部持久化机制。
- 不尝试自动修复任意模型输出错误；仅处理初始化必需工具相关的可恢复失败与缺失。

## Decisions

1. **三层防御取代手动重试循环。**

   | 层 | 机制 | 处理内容 |
   |---|---|---|
   | 第 1 层 | `experimental_repairToolCall` | 无效 JSON → 原地修复，无需重新运行 agent |
   | 第 2 层 | 基于完整性的 `stopWhen` | 缺失工具 → agent 继续运行直到所有必需工具完成 |
   | 第 3 层 | 完成后验证 | agent 结束但工具仍缺失 → 抛出错误 |

   备选方案是保留手动重试循环；该方案每次重试都重新运行整个 agent，浪费 token 和时间，且重试提示构造依赖模型理解自然语言指令。

2. **以工具成功结果作为初始化完整性的事实来源。**

   Archivist 每步返回后，系统应汇总该步及后续步骤中的工具调用结果，按工具名判断 `createStory`、`initializeTaskState`、`initializeStoryState` 是否已成功完成。这样比依赖文本内容或模型自述更可靠。

   备选方案是让 Archivist 在文本中声明完成状态，但这会把流程正确性交给自然语言输出，不能稳定覆盖漏调工具问题。

3. **使用 `experimental_repairToolCall` 就地修复无效 JSON 参数。**

   当模型生成的工具调用参数不符合 `inputSchema` 时，AI SDK 会调用 `experimental_repairToolCall` 函数。该函数使用 `generateText` + `Output.object({ schema })` 重新生成符合 schema 的参数，无需重新运行整个 agent。

   备选方案是重新调用 Archivist 并要求修正参数；该方案会重新运行整个 agent，浪费 token 和时间。

4. **在 `createAgent` 工厂中默认注入 `experimental_repairToolCall`。**

   所有 agent 都可能生成无效 JSON 工具参数，因此修复能力应该是通用的。在 `createAgent` 中解析 model 后自动注入修复函数，无需逐个 agent 配置。

   备选方案是只在 Archivist agent 中启用修复；该方案会让其他 agent 在遇到无效 JSON 时直接失败。

5. **使用基于完整性的 `stopWhen` 条件。**

   新的 `stopWhen` 条件检查所有必需初始化工具是否均已成功调用，而不是在 `createStory` 被调用后立即停止。这样即使模型先调用 `createStory` 再调用初始化工具，agent 也会继续运行直到所有工具完成。

   备选方案是保留 `hasToolCall("createStory")` 作为停止条件；该方案会在 `createStory` 被调用后立即停止，即使初始化工具尚未完成。

6. **将 archivist 初始化工具函数移至 `lib/llm/`。**

   `lib/actions/` 目录专用于 Next.js server action API。工具函数（如 `isArchivistInitComplete`、`missingInitToolNames`）是纯逻辑，应放在 `lib/llm/` 中。

   备选方案是保留在 `lib/actions/`；该方案违反了目录职责划分。

7. **优先提取可测试的纯逻辑。**

   工具结果汇总、缺失工具判断、完整性检查都应尽量拆成小的纯函数。`lib/llm/**` 涉及纯函数，实施时应按项目规则使用 TDD 先覆盖这些行为。

## Risks / Trade-offs

- **`experimental_repairToolCall` 调用 `generateText` 增加 token 消耗** → 修复函数只修复单个工具调用的参数，消耗远小于重新运行整个 agent。
- **修复函数可能失败** → 修复函数捕获所有异常并返回 `null`，让 AI SDK 正常处理错误。
- **基于完整性的 `stopWhen` 可能让 agent 运行更多步骤** → 使用 `stepCountIs(20)` 作为安全上限，避免无限循环。
- **追问流程被误判为缺失工具** → 如果 Archivist 调用 `createQuestion` 表示还需要用户补充信息，`hasToolCall("createQuestion")` 条件会立即停止 agent，不进入完整性检查。
