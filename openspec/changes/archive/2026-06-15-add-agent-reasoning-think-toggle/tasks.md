## 1. 测试先行

- [x] 1.1 为 `lib/llm/type.ts` 的 Agent schema 增加同目录测试，覆盖接受有效 `reasoning.enabled` / `reasoning.effort`、省略新字段保持兼容、拒绝无效 reasoning 取值
- [x] 1.2 为 `lib/llm/agent.ts:createAgent` 增加同目录测试，覆盖 `reasoning.enabled: true`、`reasoning.enabled: false`、仅配置 `reasoning.effort`、运行时 `providerOptions` 覆盖 frontmatter 推导配置
- [x] 1.3 先运行新增测试并确认 RED，确保测试能捕获当前未实现的新行为

## 2. 配置类型与转换实现

- [x] 2.1 在 `lib/llm/type.ts` 扩展 `AgentSchema`，新增包含 `enabled` 和 `effort` 的受限 `reasoning` 对象字段
- [x] 2.2 在 `lib/llm/agent.ts` 中抽出小型配置转换函数，把 `reasoning.enabled` / `reasoning.effort` 映射为 AI SDK `providerOptions`
- [x] 2.3 在 `createAgent` 中接入转换结果，并保持未配置新字段时不新增 reasoning provider options
- [x] 2.4 确保 `options.providerOptions` 能覆盖 frontmatter 推导出的 provider options，且不影响现有 `temperature`、`tools`、`toolChoice`、`stopWhen` 行为
- [x] 2.5 为 OpenAI Compatible provider 接入 `reasoning.enabled: false` 的 `transformRequestBody` thinking disabled 关闭逻辑

## 3. Agent 配置落地

- [x] 3.1 根据需要在目标 `planb/agents/*.md` 中添加 `reasoning.enabled` / `reasoning.effort` frontmatter，优先只给需要复杂推理的 Agent 启用
- [x] 3.2 检查 `types/markdown.d.ts` 是否仍能通过 `Agent` 类型自动获得新字段；如不能，补齐类型声明

## 4. 验证

- [x] 4.1 运行相关 `bun test` 测试文件，确认新增测试 GREEN
- [x] 4.2 运行 `bun lint --fix`
- [x] 4.3 运行 `bunx tsc --noEmit`
- [x] 4.4 运行项目单元测试，确认没有回归
