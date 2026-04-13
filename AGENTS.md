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

##### 环境检测与测试数据库

项目使用环境变量 `NODE_ENV` 来区分开发和测试环境：

- **开发/生产** (`NODE_ENV !== "test"`): 使用 `better-sqlite3` + 文件数据库
- **测试** (`NODE_ENV === "test"`): 使用 `bun:sqlite` + 内存数据库 (`:memory:`)

```ts
// 在单元测试中测试数据库相关代码时需要先初始化数据库的数据
describe("Database CRUD Operations", () => {
  beforeEach(() => {
    migrate(testdb, { migrationsFolder: "./drizzle" })
  })
  afterEach(async () => {
    await testdb.delete(schema.messages)
    await testdb.delete(schema.sessions)
    await testdb.delete(schema.users)
  })

  afterAll(() => {
    closeDatabase()
  })
})
```
