<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Planb 项目概览

**类型**: AI 驱动的互动叙事系统  
**核心特性**: 多 Agent 协作编排、Markdown 配置化、AI 流式生成
**架构特点**: Fullstack Next.js, 简单 API 都使用 Nextjs Action

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

<IMPORTANT>每次更新完代码运行下面的命令检查语法错误</IMPORTANT>，如果有则进行修正。

```bash
# ESLint
bun lint --fix
# Typescript
bunx tsc --noEmit
```

### 单元测试

项目使用 **bun:test** 作为单元测试框架，<IMPORTANT>每次更新完代码后运行单元测试。</IMPORTANT>

#### 运行测试

```bash
bun test              # 运行所有测试
bun test test/xxx.test.ts  # 运行指定测试文件
```

---

### Agent 架构

项目使用 **Markdown + Frontmatter** 方式配置 Agent，通过 `createAgent` 工厂函数创建可执行实例：

- Agent 定义文件存放在 `planb/agents/` 目录，使用 `.md` 后缀
- Frontmatter 配置 Agent 的基本信息，Markdown 内容是 Agent 的 system prompt

#### 使用 Agent

使用与 "AI SDK" 的 Agent 一致的 API。

```typescript
import { YourAgentInstance } from "@/lib/llm";

// 非流式生成
const result = await YourAgentInstance.generate({
  prompt: "用户输入",
  // 当使用了 toolcall 时：传递必要的的上下文给工具
  experimental_context: { db, sessionId },
});

// 流式生成
const result = await YourAgentInstance.stream({
  prompt: "用户输入",
});
```

#### Agent 矩阵

项目预定义了多 Agent 协作叙事系统，参见 `@planb/README.md`：

---

## Project-Specific Patterns

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

项目使用 **React Hook Form + Zod + Field 组件** 模式：

```tsx
// React Hook Form + Zod + Controller 模式
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";

const formSchema = z.object({
  source: z.string().min(1, "不能为空"),
  singularity: z.string().min(1, "不能为空"),
});

const form = useForm({
  resolver: zodResolver(formSchema),
  defaultValues: { source: "", singularity: "" },
});

// 使用 Controller + Field 组件
<Controller
  control={form.control}
  name="source"
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="source">标签</FieldLabel>
      <Input id="source" {...field} aria-invalid={fieldState.invalid} />
      <FieldDescription>描述文字</FieldDescription>
      <FieldError errors={[fieldState.error?.message]} />
    </Field>
  )}
/>;
```

**Field 组件** (`components/ui/field.tsx`)：

- `FieldGroup` - 表单字段组容器
- `Field` - 单字段容器，支持 `data-invalid` 验证状态
- `FieldLabel` - 标签（无效时自动变红色）
- `FieldDescription` - 辅助描述
- `FieldError` - 错误信息

---

### Server Action 模式

遵循 5 步模式：

```typescript
// lib/actions/story.ts
"use server";

export async function createStory(source: string, singularity: string) {
  // 1. 输入验证
  if (!source?.trim()) throw new Error("Source cannot be empty");

  // 2. Session 验证
  const session = await getSessionWithRedirect();

  try {
    // 3. 调用 Agent（可带 output schema）
    const result = await ArchivistAgent.generate({
      prompt,
      experimental_context: { db },
    });

    // 4. 数据库操作
    await db.insert(chat).values({...});
    await db.insert(story).values({...});

    // 5. 返回结果
    return { chatId, storyId };
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Operation failed");
  }
}
```

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

---

## WORKFLOW

<IMPORTANT>always use TDD with devlope</IMPORTANT>
<IMPORTANT>always check lint，type and test</IMPORTANT>
<IMPORTANT>编写计划文档时请使用中文</IMPORTANT>

### Design for isolation and clarity:

Break the system into smaller units that each have one clear purpose, communicate through well-defined interfaces, and can be understood and tested independently

For each unit, you should be able to answer: what does it do, how do you use it, and what does it depend on?

Can someone understand what a unit does without reading its internals? Can you change the internals without breaking consumers? If not, the boundaries need work.

Smaller, well-bounded units are also easier for you to work with - you reason better about code you can hold in context at once, and your edits are more reliable when files are focused. When a file grows large, that's often a signal that it's doing too much.

### Working in existing codebases:

Explore the current structure before proposing changes. Follow existing patterns.

Where existing code has problems that affect the work (e.g., a file that's grown too large, unclear boundaries, tangled responsibilities), include targeted improvements as part of the design - the way a good developer improves code they're working in.

Don't propose unrelated refactoring. Stay focused on what serves the current goal.

---
