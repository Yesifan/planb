import { defineRelationsPart } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelationsPart(schema, (r) => ({
  chat: {
    messages: r.many.messages(),
    user: r.one.user({
      from: r.chat.userId,
      to: r.user.id,
    }),
  },
  messages: {
    chat: r.one.chat({
      from: r.messages.chatId,
      to: r.chat.id,
    }),
  },
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
}));
