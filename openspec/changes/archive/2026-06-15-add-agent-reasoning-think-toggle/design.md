## Context

本项目通过 `planb/agents/*.md` 的 frontmatter 配置 Agent，再由 `lib/llm/type.ts` 的 `AgentSchema` 校验并在 `lib/llm/agent.ts:createAgent` 中转换为 AI SDK `ToolLoopAgent` 设置。当前 schema 支持 `model`、`temperature`、`tools`、`stopWhen`、`toolChoice`，但没有 reasoning 相关字段。

AI SDK 6 的 Agent 设置支持 `providerOptions`，具体 provider 再解释其中的推理参数。例如当前依赖中的 `@ai-sdk/openai-compatible` 支持 `reasoningEffort`，`@ai-sdk/deepseek` 支持 `thinking.type` 和 `reasoningEffort`。对 OpenAI Compatible 但兼容 Ark thinking 参数的 provider，关闭推理需要在 provider 创建时通过 `transformRequestBody` 注入 `thinking: { type: "disabled" }`。项目已有 reasoning 流式事件、日志和消息持久化的基础处理，但缺少在 Agent 定义层控制推理开关与强度的入口。

## Goals / Non-Goals

**Goals:**

- 允许每个 Markdown Agent 在 frontmatter 中声明 `reasoning.enabled` 开关。
- 允许每个 Markdown Agent 在 frontmatter 中声明 `reasoning.effort` 参数，并转换为 AI SDK provider options。
- 默认保持兼容：未配置新字段时不改变现有 Agent 行为。
- 将新增字段纳入 Zod schema、TypeScript 类型和单元测试。

**Non-Goals:**

- 不新增用户界面上的运行时切换按钮。
- 不改变数据库结构或现有消息持久化格式。
- 不为所有模型抽象出完整跨供应商 reasoning 标准；本次只提供项目内可用的通用配置形态和当前 provider 的透传能力。
- 不修改 Agent 的 prompt 内容，除非实施时需要给特定 Agent 显式启用配置。

## Decisions

1. **把 `reasoning.enabled` 设计为 Agent frontmatter 的布尔开关。**
   - 选择：`reasoning.enabled: true | false`，缺省表示沿用旧行为，不主动设置 provider reasoning 选项。
   - 原因：开关属于 reasoning 配置自身，放在 `reasoning` 对象内可以避免顶层字段膨胀，并让开关与推理强度保持同一语义边界。
   - 替代方案：使用独立顶层字段表达开关。放弃该方案，因为它会形成两套入口，增加冲突规则和文档成本。

2. **把 `reasoning` 设计为受限对象，而不是任意 `record<string, unknown>`。**
   - 选择：schema 支持项目当前需要的字段：`enabled` 和 `effort`；实施时再映射到 providerOptions 的 provider key。
   - 原因：受限 schema 能在 Markdown 解析时尽早发现拼写和取值错误，避免静默把无效 provider option 传给模型。
   - 替代方案：直接允许原始 `providerOptions`。放弃该方案，因为会把 provider 细节泄漏到每个 Agent 定义中，且更难测试。

3. **在 `createAgent` 中集中完成转换。**
   - 选择：`AgentSchema` 只描述配置输入，`createAgent` 负责从 `reasoning.effort` 推导 AI SDK `providerOptions`，并把原始 `reasoning` 传给项目 provider；当 OpenAI Compatible provider 需要关闭 thinking 时，provider 会返回带 `transformRequestBody` 的模型实例，再传给 `PlanbAgent`。
   - 原因：`createAgent` 是所有 Agent 实例的统一落点，能避免在 server action、tool 或 UI 调用处重复处理。
   - 替代方案：在每个 `agent.generate/stream` 调用处传入 reasoning 选项。放弃该方案，因为调用点分散且会破坏“Agent 自带配置”的模型。

4. **`reasoning.enabled: false` 必须显式关闭推理模式。**
   - 选择：当 `reasoning.enabled === false` 时，转换为 provider 的 disabled thinking 配置，并且不传递 `reasoning.effort`；DeepSeek 使用 `providerOptions.deepseek.thinking.type = "disabled"`，OpenAI Compatible 不依赖 `providerOptions`，而是在创建模型时使用 `transformRequestBody` 注入 `thinking.type = "disabled"`。
   - 原因：开关需要能覆盖误配置或默认 provider 行为；关闭时不应产生 reasoning token 成本。
   - 替代方案：`reasoning.enabled: false` 只是不启用项目配置。放弃该方案，因为它不能保证“关闭”的语义。

5. **保留调用时 options 的覆盖能力。**
   - 选择：`createAgent` 中合并配置时继续让显式传入的 `options` 拥有最终覆盖权，但需要避免无意丢弃 frontmatter 推导出的 providerOptions。
   - 原因：现有 `createAgent` 已允许调用方覆盖 Agent 设置，新增功能应保持这个扩展点。

## Risks / Trade-offs

- [Risk] 不同 provider 的 reasoning 选项名称和支持范围不同。→ Mitigation：先实现当前项目 provider 依赖中可确认的映射，并让 schema 明确取值范围；未知 provider 不强行生成不确定配置。
- [Risk] `reasoning.enabled: false` 的“关闭”语义可能无法被所有 provider 严格支持。→ Mitigation：DeepSeek 通过 providerOptions 映射为 `disabled`；OpenAI Compatible 的 Ark thinking 参数通过 `transformRequestBody` 注入关闭字段；其他 provider 保持不主动开启。
- [Risk] Agent frontmatter 新字段可能与 AI SDK 后续字段命名冲突。→ Mitigation：保持输入 schema 小而稳定，内部转换到 `providerOptions`，避免把 SDK 细节暴露为顶层字段。
- [Risk] 过度启用 reasoning 会增加成本和延迟。→ Mitigation：默认不启用，只有显式配置的 Agent 才启用。
