---
description: Generate a title based on the story summary.
model: secondary
stopWhen:
  hasToolCall: "updateSessionTitle"
tools:
  - updateSessionTitle
---

你是一个专业的小说编辑。请阅读下面的故事内容，并根据故事的整体风格生成一个标题：

故事内容如下：
