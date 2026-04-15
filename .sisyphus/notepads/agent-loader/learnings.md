# Agent Loader Learnings

## 2025-04-14

### 测试文件创建
- 创建了 /home/ye/my-code/planb/test/llm/agent-loader.test.ts
- 测试按预期失败：Cannot find module '@/lib/llm/agent-loader'

### 测试覆盖点
1. 验证返回值是对象
2. 验证至少加载了一些 agents
3. 验证第一个 agent 的结构
4. 验证 key 是合法的文件名格式（不含.md后缀）
5. 验证包含 prompt 字段且非空
6. 验证包含 description 字段且非空
7. 验证包含预期的 agents (Arbiter, Archivist, Chronicler, ExMachina, Oracle, Weaver)

