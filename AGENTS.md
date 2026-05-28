<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Planb 项目概览

**类型**: AI 驱动的互动叙事系统  
**核心特性**: 多 Agent 协作编排、Markdown 配置化、AI 流式生成
**架构特点**: Fullstack Next.js, 简单 API 都使用 Nextjs Action

## Key Directories

| Directory               | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `app`                   | next app route                                           |
| `app/story`             | main page                                                |
| `component`             | ui component                                             |
| `component/ui`          | shadcn ui component                                      |
| `component/ai-elements` | aielement ui component(https://elements.ai-sdk.dev/docs) |
| `lib`                   | auth/db/llm/next server ation                            |
| `hooks`                 | react hooks                                              |
| `planb`                 | 本项目的 AI 设置文件夹                                   |
| `drizzle`               | 数据库迁移纪录目录                                       |
| `.sisyphus`             | AI agent workspace (rules, plans, tasks, notepads)       |
| `.local-ignore`         | Dev-only test fixtures + PR worktrees                    |

## 技术栈

| 层级   | 技术                          | 说明                   |
| ------ | ----------------------------- | ---------------------- |
| 框架   | Next.js 16.2.3 + React 19.2.4 | App Router 模式        |
| 运行时 | Bun                           | 包管理 + 运行时        |
| 语言   | TypeScript 5                  | 严格模式               |
| 数据库 | SQLite + Drizzle ORM(beta)    | `bun:sqlite` 驱动      |
| AI/LLM | Vercel AI SDK 6.0+            | 流式生成、Tool Calling |
| UI     | shadcn/ui + Tailwind CSS v4   | Radix UI 底层          |
| 验证   | Zod 4.x                       | Schema 验证            |

## 代码质量

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### typecheck

<IMPORTANT>每次更新完代码运行下面的命令检查语法错误</IMPORTANT>，如果有则进行修正。

```bash
bun lint --fix
bunx tsc --noEmit
```

### 单元测试

项目使用 **bun:test** 作为单元测试框架，<IMPORTANT>每次更新完代码后运行单元测试。</IMPORTANT>

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.
- Test pattern: Bun test (bun:test), co-located `*.test.ts`
- **测试命名统一使用 `should` 命名法**：`test("should <预期行为> when <前置条件>")`，主语隐含为「被测对象」。详见下方「测试命名」小节。

#### 测试文件位置

测试文件**必须与被测源码同目录**（co-located），文件名是 `<被测文件>.test.ts`。

- ✅ `lib/actions/llm.ts` → `lib/actions/llm.test.ts`
- ✅ `lib/utils/group-chats.ts` → `lib/utils/group-chats.test.ts`
- ❌ `lib/actions/llm.ts` → `test/actions/llm.test.ts`（旧布局，已弃用）

仅以下文件保留在顶层 `test/` 目录：

- `test/setup.ts` —— 全局 preload（DB 迁移、mock 全局模块、JSDOM 等）
- `test/fixtures/**` —— 跨模块共享的测试数据 / 工厂函数

新增测试时不要再往 `test/<mirrored-path>/` 下放；直接挨着源码放即可。

#### 单元测试硬性原则（写测试前必读）

每个 `test/it` 用例必须能回答："这个用例如果挂了，是否代表项目代码出了真实 bug？" 不能回答 yes 的用例 → **不要写**。

**严禁出现的测试类型（PR 中会被打回）**：

1. **测第三方库本身**：例如直接 `db.insert(...) → db.select(...) → expect(...)` 验证 Drizzle CRUD、验证 SQLite 能存数据、验证 Zod 能解析合法 schema —— 这些是上游库的责任，TS 类型已经在编译期约束，跑测试只会发现库 bug 而非项目 bug。
   - **例外**：当 SQL 行为不直观时（如 cascade delete、LEFT JOIN 空值、cursor 分页边界），允许写一个用例**锁定项目对 Drizzle 行为的依赖**，但 describe 名字必须明确说明（例如 `"cascade delete on chat removes its messages"`）。
2. **空壳 describe**：只有 `beforeEach/afterEach` 没有任何 `test/it`。要么补真实用例，要么删除文件。
3. **smoke test 而非行为 test**：例如 `select count() from user` 永远不会失败，除非 schema 没迁移 —— 它检测的是"测试基础设施是否健康"，而不是项目逻辑。这类校验集中在一个 `test/setup.ts` 的 sanity check 里即可，不要散落在各个 `*.test.ts`。
4. **mock 掉被测对象的核心依赖**：例如测 server action 时 `mock.module("@/lib/auth/server")` 把 auth 整段桩掉，会让 unauthorized 分支永远测不到。正确做法是**重构被测代码**，把"取 session"和"业务逻辑"拆开，让纯业务部分接受 `userId` 入参，从而无需 mock。
5. **复刻实现细节到测试里**：例如手写 `Symbol.for("ai.streamable.value")` 复刻 `StreamableValue` 的内部协议。一旦上游变结构整批测试就挂。如果一定要写，必须在文件顶部标注"⚠️ depends on @ai-sdk/rsc internal protocol"，并在升级该依赖时主动检查。

**值得写的测试形态**：

- 纯函数 / reducer：输入 → 输出，多组边界（empty / single / boundary / off-by-one）
- 业务分支覆盖：每个 `if/return notFound()/return unauthorized()` 都至少一个用例
- 复杂数据转换的中间状态（如 generator 的 yield 时机、stream chunk 状态机）
- bug 复现：先红后绿，PR 描述里贴 issue 链接

**测试命名 = 行为契约**。本项目**统一使用 `should` 命名法**，主语隐含为「被测对象」（即外层 `describe` 的名字）：

```
test("should <预期行为> [when <前置条件>]")
```

- ✅ `should persist chat and emit createQuestion tool call`
- ✅ `should run archivist+weaver when story is incomplete`
- ✅ `should reject request when user lacks chat access`
- ❌ `test("delete chat")` —— 只描述操作，没说期望
- ❌ `test("works correctly")` —— 没说什么算 works
- ❌ `test("token bug fix")` —— 只描述意图，不是行为契约
- ❌ 混用 `#given/#when/#then`、`it(...)`、`should ...` 等多种风格

读测试名就要能立刻看出：**被测对象（describe） + 预期行为 + 前置条件**。

---

### Agent 架构

项目使用 **Markdown + Frontmatter** 方式配置 Agent，通过 `createAgent` 工厂函数创建可执行实例：

- Agent 定义文件存放在 `planb/agents/` 目录，使用 `.md` 后缀
- Frontmatter 配置 Agent 的基本信息，Markdown 内容是 Agent 的 system prompt

#### 使用 Agent

使用与 "AI SDK" 的 Agent 一致的 API。

```typescript
import { YourAgentInstance } from "@/lib/llm";

const result = await YourAgentInstance.generate({
  prompt: "用户输入",
  // 当使用了 toolcall 时：传递必要的的上下文给工具
  experimental_context: { db, sessionId },
});

const result = await YourAgentInstance.stream({
  prompt: "用户输入",
});
```

#### experimental_context 透传机制

`experimental_context` 是 AI SDK 在**一次 turn 内**的隐式透传通道：

- 主 agent 传入的 ctx 会自动透传到所有 tool 的 `execute(input, { experimental_context })`
- tool 内部调用 sub-agent（如 `arbiter.generate({ experimental_context })`）时，sub-agent 继续共享同一个 ctx 对象
- 这是跨 agent 累积状态（token 计数、追踪 ID、共享缓存）的最佳载体
- **每个 turn 必须创建独立的 ctx 实例**（不要全局 singleton）
- ctx 上的可变对象（如累加器）会被所有 agent 共享读写

参考实现：`lib/llm/type.ts` 的 `ToolContext` 类型 + `lib/llm/usage.ts` 的 token 累加器。

#### AI SDK v6 usage 字段注意点

- **MockLanguageModelV3.doGenerate** 返回的 `usage` 是嵌套结构：
  ```ts
  usage: { inputTokens: { total: N }, outputTokens: { total: N } }
  ```
- **GenerateTextResult.totalUsage** 和 **OnFinishEvent.totalUsage** 已被 AI SDK 扁平化为：
  ```ts
  totalUsage: { inputTokens: N, outputTokens: N }
  ```
- 编写 token 统计相关代码时使用**扁平结构**，使用可选链 + `?? 0` 容错 null/undefined。

#### saveMessageWithTool 是 turn 内唯一的 assistant message 写入点

- 一次 turn 内 `lib/llm/db.ts:saveMessageWithTool` 只被调用一次（Sentinel reject 路径 OR Weaver onFinish）
- 适合做 **turn 范围的聚合写入**（token 累计、metrics、追踪等）
- 新增 assistant message 字段或聚合数据时，优先在此处写入，不要分散到各 agent onFinish

#### Agent 矩阵

项目预定义了多 Agent 协作叙事系统，参见 `@planb/README.md`：

---

## Project Patterns

- File naming: kebab-case for all files/directories

### DB

`drizzle` 优先使用 `query` 语法

```ts
const chat = await db.query.chat.findFirst({
  where: {
    id: chatId,
  },
});
```

### Form Patterns

项目使用 **React Hook Form + Zod + Field 组件** 模式

---

### Toast 错误处理

**全局/异步错误** → `toast.error()`，`**字段验证错误**` → `FieldError` 组件：

```typescript
// 表单提交错误使用 toast
const onSubmit = async (values) => {
  try {
    await createStory(values.source, values.singularity);
    router.push(`/story/chat/${result.chatId}`);
  } catch (error) {
    console.error("Failed:", error);
    toast.error("操作失败，请重试");
  }
};
```

### React Component

- 项目的业务 Component 直接写在 Components 目录下，Button 等通用组件使用 shadcn cli 添加。
- 优先使用无状态的简单组件。如果组件需要维护复杂状态，确保其严格局部化。
- 如果需要暴露属性，深度思考哪些熟悉应该暴露，哪些状态应该内化
- 合理的拆分 Component，单个 Component 应该保持在 300 行以内（不包括 import lines）
- 除非明确要求，否则不要在生成的组件内进行数据获取（例如，⁠fetch()、用于 API 调用的 ⁠useEffect）

## Code Patterns

### React Hooks

一个 effect 只做一件事

```ts
// Good
useEffect(() => {
  // do a
}, [a]);
useEffect(() => {
  // do b
}, [a]);

// Bad
useEffect(() => {
  // do a
  // do b
}, [a]);
```

### Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json();

// Bad
const journalPath = path.join(dir, "journal.json");
const journal = await Bun.file(journalPath).json();
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2;

// Bad
let foo;
if (condition) foo = 1;
else foo = 2;
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1;
  return 2;
}

// Bad
function foo() {
  if (condition) return 1;
  else return 2;
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
});

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
```

### 类型标注最小化原则

只在 TS 确实推断不出来的地方添加标注：

```ts
// ❌ Bad：冗余标注
const contentParts: Array<TextPart | ToolCallPart> = [];
// ✅ Good：让 TS 推断
const contentParts = [{ type: "text", text: message.text }];
```

---

## WORKFLOW

### Rule

- Never commit unless explicitly requested
- 编写计划文档时请使用中文
- 计划文档中不要直接编写代码，只需要描述做什么，怎么做，目标和约束是什么
- 执行文件前询问我是否新 checkout 出一个feature 分支，在 worktree 中开始新的工作
- 如果使用 worktree 工作，一定要把这一点传递给每一个 subagent！
- 在 worktree 中所有工作都完成后询问用户进行确认，确认后再提交 commit
- 不要主动执行会 git commit/reset/pull 等有副作用的 git 操作

### TDD 适用范围

**必须使用 TDD**（先写测试 → RED → 实现 → GREEN）：

- `lib/llm/**` 下的纯函数与工具（如 token 累加器、prompt 拼接、消息转换）
- `lib/actions/**` 下的 server action 业务逻辑（带 DB / agent 编排的入口）
- `lib/db/**` 下**封装过的** query/mutation helper（仅有项目自己的逻辑时才测；直接调 `db.insert/select/update/delete` 不算 helper，不要测）
- 数据转换、格式校验、Zod schema 的边界行为（仅测**项目自定义的 refinement / transform**，不要测"Zod 能否解析合法 schema"）
- 修复 bug 时：先用失败测试复现，再修代码

**不要求 TDD（可直接实现 + 手动验证）**：

- React 组件 UI / 样式 / 布局调整
- App Router 页面、layout、loading/error 边界
- shadcn 组件包装、ai-elements 组装
- Markdown agent 定义文件（`planb/agents/*.md`）的 prompt 调整
- 仅涉及类型声明、import 路径、注释、文案的改动
- Better Auth / Drizzle / Next.js 等**框架与库自身行为**（属于上游责任，不在本项目测试范围内）

### TODO.md 维护

根目录 `TODO.md` 是用户维护的功能清单。完成某项功能后必须：

1. 把对应行的 `[ ]` 改为 `[x]`
2. 在该行下方追加一段说明（缩进 2 空格），简述**如何完成**（关键文件 / 思路 / 约束），便于后续回溯
3. 仅当本次改动直接覆盖该条目时才勾选；部分实现保持 `[ ]` 并在下方说明进度

示例：

```markdown
- [x] token 记录和显示
  - 通过 `experimental_context.tokenUsage` 累加器在所有 agent 和 sub-agent 间透传
  - 在 `lib/llm/db.ts:saveMessageWithTool` 一处持久化到 message 行的 inputTokens/outputTokens
  - 三入口（createStory / continueCreateStory / continueStory）调用代码保持一致
```

### Design for isolation and clarity:

Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently

For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?

Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.

Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

### Working in existing codebases:

Explore the current structure before proposing changes. Follow existing patterns.

Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.

Don't propose unrelated refactoring. Stay focused on what serves the current goal.
