<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## 代码质量

<IMPORTANT>每次更新完代码运行下面的命令检查语法错误</IMPORTANT>，如果有则进行修正。

```
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

#### 数据库测试

项目使用环境变量 `NODE_ENV` 来区分开发和测试环境：

- **开发/生产** (`NODE_ENV !== "test"`): 使用 `bun:sqlite` + 文件数据库
- **测试** (`NODE_ENV === "test"`): 使用 `bun:sqlite` + 内存数据库 (`:memory:`)

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
