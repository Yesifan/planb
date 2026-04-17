import { defineRelationsPart } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelationsPart(schema, (r) => ({
  users: {
    sessions: r.many.sessions(),
  },
  sessions: {
    user: r.one.users({
      from: r.sessions.userId,
      to: r.users.id,
    }),
    messages: r.many.messages(),
  },
  messages: {
    session: r.one.sessions({
      from: r.messages.sessionId,
      to: r.sessions.id,
    }),
  },
}));
