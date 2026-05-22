import { describe, expect, it } from "bun:test";

import type { Chat } from "@/lib/db/schema";

import { groupChatsByTime } from "./group-chats";

const makeChat = (id: string, updatedAt: Date): Chat => ({
  id,
  userId: null,
  title: `chat-${id}`,
  createdAt: updatedAt,
  updatedAt,
});

describe("groupChatsByTime", () => {
  describe("#given empty list", () => {
    it("#when called #then returns empty array", () => {
      expect(groupChatsByTime([])).toEqual([]);
    });
  });

  describe("#given all chats updated today", () => {
    it("#when grouped #then returns only 今天 group", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [
        makeChat("a", new Date(2026, 4, 21, 14, 0, 0)),
        makeChat("b", new Date(2026, 4, 21, 10, 0, 0)),
      ];
      const result = groupChatsByTime(chats, now);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("今天");
      expect(result[0].chats).toHaveLength(2);
    });
  });

  describe("#given chats spanning today and earlier (no this-week middle)", () => {
    it("#when grouped #then returns 今天 + 更早", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [
        makeChat("a", new Date(2026, 4, 21, 14, 0, 0)),
        makeChat("b", new Date(2026, 3, 1, 10, 0, 0)),
      ];
      const result = groupChatsByTime(chats, now);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("今天");
      expect(result[1].label).toBe("更早");
    });
  });

  describe("#given chats spanning today, this week, and earlier", () => {
    it("#when grouped #then returns all three groups in order", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [
        makeChat("today-1", new Date(2026, 4, 21, 14, 0, 0)),
        makeChat("week-1", new Date(2026, 4, 19, 10, 0, 0)),
        makeChat("earlier-1", new Date(2026, 3, 1, 10, 0, 0)),
      ];
      const result = groupChatsByTime(chats, now);
      expect(result).toHaveLength(3);
      expect(result.map((g) => g.label)).toEqual(["今天", "本周", "更早"]);
      expect(result[0].chats[0].id).toBe("today-1");
      expect(result[1].chats[0].id).toBe("week-1");
      expect(result[2].chats[0].id).toBe("earlier-1");
    });
  });

  describe("#given updatedAt exactly at today 00:00:00", () => {
    it("#when grouped #then chat belongs to 今天", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [makeChat("a", new Date(2026, 4, 21, 0, 0, 0))];
      const result = groupChatsByTime(chats, now);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("今天");
    });
  });

  describe("#given updatedAt exactly at Monday 00:00:00", () => {
    it("#when grouped on Thursday #then chat belongs to 本周", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [makeChat("a", new Date(2026, 4, 18, 0, 0, 0))];
      const result = groupChatsByTime(chats, now);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe("本周");
    });
  });

  describe("#given multiple chats per group with DESC order", () => {
    it("#when grouped #then within-group order is preserved", () => {
      const now = new Date(2026, 4, 21, 15, 0, 0);
      const chats = [
        makeChat("today-newer", new Date(2026, 4, 21, 14, 0, 0)),
        makeChat("today-older", new Date(2026, 4, 21, 8, 0, 0)),
        makeChat("week-newer", new Date(2026, 4, 20, 14, 0, 0)),
        makeChat("week-older", new Date(2026, 4, 18, 5, 0, 0)),
      ];
      const result = groupChatsByTime(chats, now);
      expect(result[0].chats.map((c) => c.id)).toEqual([
        "today-newer",
        "today-older",
      ]);
      expect(result[1].chats.map((c) => c.id)).toEqual([
        "week-newer",
        "week-older",
      ]);
    });
  });

  describe("#given today is Monday", () => {
    it("#when grouped #then week-start equals today and no 本周 group appears for older chats", () => {
      const now = new Date(2026, 4, 18, 15, 0, 0);
      const chats = [
        makeChat("today", new Date(2026, 4, 18, 10, 0, 0)),
        makeChat("yesterday", new Date(2026, 4, 17, 10, 0, 0)),
      ];
      const result = groupChatsByTime(chats, now);
      expect(result.map((g) => g.label)).toEqual(["今天", "更早"]);
    });
  });
});
