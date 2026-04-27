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
- Test pattern: Bun test (bun:test), co-located \*.test.ts, given/when/then style (nested describe with #given/#when/#then prefixes or inline // given / // when / // then comments)

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

### Code Patterns

Reduce total variable count by inlining when a value is only used once.

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

---

## WORKFLOW

- Never commit unless explicitly requested
- always use TDD with devlope new feature
- 编写计划文档时请使用中文
- 计划文档中不要直接编写代码，只需要描述做什么，怎么做，目标和约束是什么
- 执行文件前询问我是否新 checkout 出一个feature 分支，在 worktree 中开始新的工作
- 如果使用 worktree 工作，一定要把这一点传递给每一个 subagent！

### Design for isolation and clarity:

Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently

For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?

Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.

Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

### Working in existing codebases:

Explore the current structure before proposing changes. Follow existing patterns.

Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.

Don't propose unrelated refactoring. Stay focused on what serves the current goal.
