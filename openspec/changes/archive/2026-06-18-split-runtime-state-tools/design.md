## Context

当前 `initializeStoryState` / `updateStoryState` 同时维护 `protagonist_state` 和 `story.world_snapshot`。这让主角 profile、五维状态和世界态势绑定在同一个工具契约里，Runtimekeeper 也必须把不同状态域一起更新。与此同时，主角资源被写在 profile 文本中，既难以按固定模板维护，也容易和主角概况重复。

本次变更会影响 LLM tool schema、DB schema、Archivist 初始化门控、Runtimekeeper 续写后的状态维护流程和测试 fixture，属于跨模块契约调整。

## Goals / Non-Goals

**Goals:**

- 让初始 worldSnapshot 成为 `createStory` 保存的故事基础设定之一。
- 将主角状态和世界快照拆成独立工具，支持后续按需更新。
- 在 `protagonist_state` 增加 nullable `resources` 文本字段，并通过 Markdown 模板维护主角资源。
- 保持 Archivist 正常初始化主角状态；Runtimekeeper 的主角初始化只作为缺失状态的保底路径。
- 允许 Runtimekeeper 判断无需状态更新时不调用工具，自然结束；其文本输出只进入日志，不展示给用户。
- 更新测试以锁定新契约。

**Non-Goals:**

- 不把 resources 做成 JSON 结构化数组。
- 不改变 `initializeTaskState` / `updateTaskState` 的任务板 Markdown 模型。
- 不改变 Weaver 的叙事生成职责。
- 不引入新的外部依赖。

## Decisions

### 1. `createStory` 保存初始 worldSnapshot

`createStory` 的输入扩展为 `title / type / worldview / worldSnapshot`，职责描述改为“保存故事基础设定和初始世界快照”。`worldSnapshot` 使用初始化专用详细描述，强调它是开局时点的世界态势基线，来自已确认设定。

备选方案是新增 `initializeWorldSnapshot` 并保持 `createStory` 只写基础设定。最终选择合并到 `createStory`，因为初始世界快照是故事设定完成的一部分，且用户明确倾向合并。

### 2. 拆分主角状态与世界快照更新

用 `initializeProtagonistState` 替代 `initializeStoryState`，初始化 `profile / resources / dimensions`。用 `updateProtagonistState` 更新 `profile / resources / dimensionValues`，保留五维名称和描述，只更新数值。新增 `updateWorldSnapshot` 单独维护 `story.world_snapshot`。

`profile` 只记录主角当前基础状况，避免和 `resources`、`worldSnapshot` 重复：包括当前身体/身份状态、所处时间和地点、当前职位或身份，以及一句 30 字以内的大局层面局势概括。资源清单进入 `resources`，世界态势细节进入 `worldSnapshot`。

这样后续 Runtimekeeper 可以只更新实际变化的状态域，避免世界态势和主角状态相互阻塞。

### 3. resources 使用 nullable Markdown text

`protagonist_state.resources` 为 nullable `text` 字段。数据库允许 `null` 以兼容旧数据；tool 输入仍要求非空 Markdown 字符串，正常写入后即进入稳定模板。

资源模板为：

```md
## 可用资源

暂无
```

或：

```md
## 可用资源

### 资源名称
- 描述：
- 价值：
- 备注：
```

### 4. Archivist 初始化门控保持三件套

初始化完成条件从 `createStory + initializeStoryState + initializeTaskState` 改为 `createStory + initializeProtagonistState + initializeTaskState`。`worldSnapshot` 已包含在 `createStory` 内，因此不需要单独初始化工具。

### 5. Runtimekeeper 允许按需更新和空工具调用

Runtimekeeper 不再要求同轮必须调用 story-state 和 task-state 工具。它可以调用 `initializeProtagonistState` 作为缺失主角状态保底，也可以按需调用 `updateProtagonistState`、`updateWorldSnapshot`、`updateTaskState` 的任意子集，或一个工具都不调用自然结束。若产生普通文本，服务端只记录日志，不展示给用户。

## Risks / Trade-offs

- 初始 `worldSnapshot` 合并进 `createStory` 后，`createStory` 输入体积会变大 → 通过详细但聚焦的初始化快照描述控制内容范围。
- Runtimekeeper 允许空工具调用可能降低状态更新强制性 → 通过 prompt 明确状态判断标准，并用测试覆盖“无工具调用不展示文本”的编排行为。
- `resources` nullable 会让读取方遇到旧数据空值 → 读取上下文时将 `null` 视为无资源或不展示资源段；tool 写入仍要求非空 Markdown。
- 工具名变更会破坏旧 fixture 和测试 → 同步更新所有测试与初始化门控，避免兼容旧 tool 名造成双契约。
