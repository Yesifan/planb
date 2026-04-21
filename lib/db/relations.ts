import { defineRelationsPart } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelationsPart(schema, (r) => ({
  user: {
    sessions: r.many.session(),
    accounts: r.many.account(),
    chats: r.many.chat(),
  },
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },
  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },
  chat: {
    user: r.one.user({
      from: r.chat.userId,
      to: r.user.id,
    }),
    messages: r.many.messages(),
    history: r.many.history(),
  },
  messages: {
    chat: r.one.chat({
      from: r.messages.chatId,
      to: r.chat.id,
    }),
  },
  story: {
    chat: r.one.chat({
      from: r.story.chatId,
      to: r.chat.id,
    }),
  },
  history: {
    chat: r.one.chat({
      from: r.history.chatId,
      to: r.chat.id,
    }),
  },
}));
