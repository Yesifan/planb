import type { Chat } from "@/lib/db/schema";

export type TimeGroup = {
  label: string;
  chats: Chat[];
};

const startOfToday = (now: Date) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfThisWeek = (now: Date) => {
  const d = startOfToday(now);
  const sundayIndex = d.getDay();
  const daysSinceMonday = sundayIndex === 0 ? 6 : sundayIndex - 1;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
};

export const groupChatsByTime = (
  chats: Chat[],
  now: Date = new Date(),
): TimeGroup[] => {
  const todayStart = startOfToday(now).getTime();
  const weekStart = startOfThisWeek(now).getTime();

  const today: Chat[] = [];
  const thisWeek: Chat[] = [];
  const earlier: Chat[] = [];

  chats.forEach((chat) => {
    const t = chat.updatedAt.getTime();
    if (t >= todayStart) {
      today.push(chat);
      return;
    }
    if (t >= weekStart) {
      thisWeek.push(chat);
      return;
    }
    earlier.push(chat);
  });

  return [
    { label: "今天", chats: today },
    { label: "本周", chats: thisWeek },
    { label: "更早", chats: earlier },
  ].filter((g) => g.chats.length > 0);
};
