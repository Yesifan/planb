// test-setup.ts
import "@/envConfig";

import { plugin } from "bun";
import { beforeAll, beforeEach, mock } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { matterBunLoader } from "@/loader/matter";

// Mock @ai-sdk/rsc's createStreamableValue with a behaviorally identical
// implementation. The real one ships only via the `react-server` export
// condition (rsc-server.mjs); Bun's test runner resolves to rsc-client.mjs
// which omits it. Re-export the real readStreamableValue so consumers see
// no behavioral difference.
mock.module("@ai-sdk/rsc", () => {
  const STREAMABLE_VALUE_TYPE = Symbol.for("ui.streamable.value");

  function createResolvablePromise<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function createStreamableValue<T>(initialValue?: T) {
    let closed = false;
    let currentValue: T | undefined = initialValue;
    let currentError: unknown;
    let resolvable = createResolvablePromise<unknown>();
    let currentPromise: Promise<unknown> | undefined = resolvable.promise;

    const assertOpen = (method: string) => {
      if (closed) throw new Error(`${method}: Value stream is already closed.`);
    };

    const createWrapped = (initialChunk?: boolean): Record<string, unknown> => {
      const init: Record<string, unknown> =
        currentError !== undefined
          ? { error: currentError }
          : { curr: currentValue };
      if (currentPromise) init.next = currentPromise;
      if (initialChunk) init.type = STREAMABLE_VALUE_TYPE;
      return init;
    };

    const streamable = {
      get value() {
        return createWrapped(true);
      },
      update(value: T) {
        assertOpen(".update()");
        const resolvePrevious = resolvable.resolve;
        resolvable = createResolvablePromise<unknown>();
        currentValue = value;
        currentPromise = resolvable.promise;
        resolvePrevious(createWrapped());
        return streamable;
      },
      append(value: T) {
        assertOpen(".append()");
        const resolvePrevious = resolvable.resolve;
        resolvable = createResolvablePromise<unknown>();
        if (typeof currentValue === "string" && typeof value === "string") {
          currentValue = (currentValue + value) as T;
        } else {
          currentValue = value;
        }
        currentPromise = resolvable.promise;
        resolvePrevious(createWrapped());
        return streamable;
      },
      done(...args: [T?]) {
        assertOpen(".done()");
        closed = true;
        currentPromise = undefined;
        if (args.length) {
          currentValue = args[0];
          resolvable.resolve(createWrapped());
        } else {
          resolvable.resolve({});
        }
        return streamable;
      },
      error(error: unknown) {
        assertOpen(".error()");
        closed = true;
        currentError = error;
        currentPromise = undefined;
        resolvable.resolve({ error });
        return streamable;
      },
    };
    return streamable;
  }

  function isStreamableValue(value: unknown): boolean {
    return (
      value != null &&
      typeof value === "object" &&
      "type" in value &&
      (value as { type: unknown }).type === STREAMABLE_VALUE_TYPE
    );
  }

  function readStreamableValue<T>(streamableValue: {
    curr: T | undefined;
    next?: Promise<unknown>;
  }) {
    if (!isStreamableValue(streamableValue)) {
      throw new Error(
        "Invalid value: this hook only accepts values created via `createStreamableValue`.",
      );
    }
    return {
      [Symbol.asyncIterator]() {
        let row:
          | { curr?: T; next?: Promise<unknown>; error?: unknown }
          | Promise<unknown> = streamableValue;
        let value: T | undefined = streamableValue.curr;
        let isDone = false;
        let isFirstIteration = true;
        return {
          async next(): Promise<{ value: T | undefined; done: boolean }> {
            if (isDone) return { value, done: true };
            row = (await row) as typeof row;
            if (typeof row === "object" && row !== null && "error" in row) {
              throw (row as { error: unknown }).error;
            }
            const snap = row as { curr?: T; next?: Promise<unknown> };
            if ("curr" in snap) {
              value = snap.curr;
              if (!snap.next) {
                isDone = true;
                return { value, done: false };
              }
            }
            if (snap.next === undefined) return { value, done: true };
            row = snap.next as Promise<unknown>;
            if (isFirstIteration) {
              isFirstIteration = false;
              if (value === undefined) return this.next();
            }
            return { value, done: false };
          },
        };
      },
    };
  }

  return { createStreamableValue, readStreamableValue };
});

plugin({
  name: "next-js-polyfills",
  setup(build) {
    build.onLoad({ filter: /\.md$/ }, matterBunLoader);
  },
});

beforeAll(() => {
  migrate(testdb, { migrationsFolder: "./drizzle" });
});

beforeEach(async () => {
  // Clear tables if they exist - for tests that run before migrations are applied

  await testdb.delete(schema.message);
  await testdb.delete(schema.chat);
  await testdb.delete(schema.session);
  await testdb.delete(schema.account);
  await testdb.delete(schema.user);

  // Better Auth tables will be cleared when needed in tests
  // user, session, account, verification are created by Better Auth migrations
});
