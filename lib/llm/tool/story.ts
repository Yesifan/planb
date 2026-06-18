import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { chat, story } from "@/lib/db/schema";
import logger from "@/lib/logger";

import { ToolContext } from "../type";

const TITLE_DESCRIPTION = [
  "故事标题。根据故事来源、特异点性质和故事类型取一个有吸引力的标题。",
  "不要使用书名号、引号、冒号或其他装饰符号。",
  "标题应体现世界线分叉后的核心张力，而不是复述用户输入。",
].join("\n");

const TYPE_DESCRIPTION = [
  "故事类型。根据故事来源和特异点性质准确判断。",
  "常见分类包括：历史推演、玄幻/仙侠、科幻/赛博朋克、悬疑/克苏鲁、权谋/宫斗、推理/探案。",
  "如果这些分类都不贴切，可以给出更合适的短分类。",
].join("\n");

const WORLDVIEW_DESCRIPTION = [
  "800-1500 字的世界设定。它是世界的'操作系统'，独立于任何单个角色和剧情桥段存在。",
  "所有内容必须截止到故事开始时刻。禁止写'将要发生'、'即将到来'、'未来会'这类未来事件。",
  "必须包含以下维度：",
  "### 世界背景",
  "- 特异点前的深层历史：具体说明哪些人在什么时候做了什么事，这些事如何累积并最终导致分歧。",
  "- 涟漪效应：导致特异点的变化还对贸易、制度、势力、技术、迁徙、信仰或社会结构造成了哪些额外影响。",
  "- 势力渊源：主要势力的起源、崛起、恩怨、同盟、敌对关系和形成原因。",
  "- 社会形态与制度沿革：政治结构、阶层体系、经济模式、法律/宗教/修行/技术体系如何演变到当前状态。",
  "### 历史锚点",
  "列出对当前世界格局有决定性和持续性影响的关键历史事件。每个锚点写清：何时发生、谁参与、直接后果、至今如何塑造世界。",
  "### 规则边界",
  "明确 3-5 条这个世界中不可能或被禁止的事，例如技术天花板、信息传播速度、个体力量上限、超自然限制、制度红线。",
  "这些边界会被 Sentinel 和 Oracle 用来判断玩家行动是否可行。",
  "### 纪年体系",
  "必须明确纪年方式：公元纪年、年号纪年、星历、王朝历或其他体系，并写清故事开始时的具体年份/日期。",
  "### 关键设定",
  "写清世界基本属性、地理气候、关键地点、关键资源、关键组织，以及当前已经具备影响力的因素。",
  "不要写空泛背景；每条设定都应能影响后续推演。",
].join("\n");

const WORLD_SNAPSHOT_DESCRIPTION = [
  "故事开局时点的世界态势基线。它是世界当前状态的唯一摘要来源，来自已经确认的故事设定。",
  "必须从世界视角概括开局时的重要事项，包括主角知道的信息、主角不知道但已经真实发生的暗线、关键势力变化、人物处境和环境状态。",
  "事实只能被新的事实覆盖，不能无故删除或改写；如果信息不足，基于已有事实给出保守状态，不要编造新事件。",
  "必须压缩到最重要事项，避免冗长细节、氛围描写、作者旁白和未来预告。",
  "推荐使用以下分区：",
  "## 世界当前时点",
  "当前日期/时期、地点、故事所处阶段，以及开局后的整体局势。",
  "## 关键势力",
  "主要势力的当前资源、立场、行动方向、冲突关系和信息掌握情况。",
  "## 关键人物",
  "主角、核心 NPC、敌友和潜在变量人物的当前处境、诉求、承诺、伤亡、位置和态度。",
  "## 关键环境状态",
  "政治、军事、经济、自然、技术、超自然规则、封锁、期限、倒计时等会影响下一步行动的环境条件。",
  "## 已发生的重要事件",
  "保留会影响后续因果的事件、线索、暗线、誓言、证据、任务结果和不可逆变化。",
].join("\n");

const SYSTEM_SETTING_DESCRIPTION = [
  "完整的金手指设定文本。必须使用清晰的 Markdown 层级，方便 System Agent 后续读取。",
  "必须包含以下维度：",
  "# 金手指设定",
  "## 本源",
  "说明金手指从何而来、为什么选中主角、在世界底层规则中的定位，以及其他人是否可能拥有类似能力。",
  "## 核心能力",
  "说明根本功能、能力边界、代价、限制、越界后果、成长路径、瓶颈和激活条件。",
  "## 交互方式",
  "说明主角如何感知/使用它：面板、声音、直觉、梦境、符号、概念灌输等；能否主动查询，能查询什么。",
  "## 任务机制",
  "如果存在任务系统，说明任务来源、类型、约束、时限、失败惩罚、拒绝后果，以及任务如何推动剧情。没有则明确无任务机制。",
  "## 奖励机制",
  "如果存在奖励，说明奖励类型、付出与收益平衡、叙事意义和限制。没有则明确无奖励机制。",
  "## 与世界的关联",
  "说明它如何嵌入世界规则、会对世界造成什么影响、为什么不会破坏故事类型和世界逻辑。",
].join("\n");

export const CreateStorySchema = z.object({
  title: z
    .string()
    .min(1)
    .describe(TITLE_DESCRIPTION),
  type: z
    .string()
    .min(1, "Story type cannot be empty")
    .describe(TYPE_DESCRIPTION),
  worldview: z
    .string()
    .min(1, "Worldview cannot be empty")
    .describe(WORLDVIEW_DESCRIPTION),
  worldSnapshot: z
    .string()
    .min(1, "World snapshot cannot be empty")
    .describe(WORLD_SNAPSHOT_DESCRIPTION),
});

export const createStory = tool({
  description:
    "故事设定保存工具：调用后将故事的 title、type、worldview 和初始 worldSnapshot 保存到数据库。本工具只保存故事基础设定和初始世界快照，不保存主角状态、任务状态、金手指设定等其他内容。",
  inputSchema: CreateStorySchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    const log = logger.child({
      traceId: traceId ?? "unknown",
      tool: "createStory",
    });
    try {
      log.info({ input: JSON.stringify(input) }, "Tool CreateStory");
      await db
        .update(chat)
        .set({
          title: input.title,
        })
        .where(eq(chat.id, chatId));
      await db
        .update(story)
        .set({
          type: input.type,
          worldview: input.worldview,
          worldSnapshot: input.worldSnapshot,
        })
        .where(eq(story.chatId, chatId));
      log.info({ chatId }, "tool.createStory.end");
      return "Create Success!";
    } catch (error) {
      log.error({ error }, "tool.createStory.error");
      throw error;
    }
  },
});

export const SaveSystemSettingSchema = z.object({
  system: z
    .string()
    .min(1, "金手指设定不能为空")
    .describe(SYSTEM_SETTING_DESCRIPTION),
});

export const saveSystemSetting = tool({
  description:
    "当金手指设定生成完成后，调用本工具将设定保存到故事中。保存后设定可被 System Agent 在主流程中读取和使用。",
  inputSchema: SaveSystemSettingSchema,
  async execute(input, { experimental_context }) {
    const { db, chatId, traceId } = experimental_context as ToolContext;
    const log = logger.child({
      traceId: traceId ?? "unknown",
      tool: "saveSystemSetting",
    });
    try {
      log.info({ input: input.system }, "tool.saveSystemSetting");
      await db
        .update(story)
        .set({ system: input.system })
        .where(eq(story.chatId, chatId));
      log.info({ chatId }, "tool.saveSystemSetting.end");
      return "保存成功！";
    } catch (error) {
      log.error({ error }, "tool.saveSystemSetting.error");
      throw error;
    }
  },
});
