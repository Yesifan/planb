// test-setup.ts
import "@/envConfig";

import * as matchers from "@testing-library/jest-dom/matchers";
import { plugin } from "bun";
import { beforeAll, beforeEach, mock } from "bun:test";
import { expect } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { JSDOM } from "jsdom";

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { matterBunLoader } from "@/loader/matter";

// Mock @ai-sdk/rsc before any module loads it.
// In Bun's test env, the package resolves to rsc-client.mjs which omits
// createStreamableValue (a server-only export). Provide a minimal fake that
// satisfies the action code's usage and keeps readStreamableValue working
// against the same protocol.
mock.module("@ai-sdk/rsc", () => {
  function createStreamableValue<T>() {
    let current: T | undefined;
    let nextResolve:
      | ((value: { curr: T | undefined; done: boolean }) => void)
      | undefined;
    let next = new Promise<{ curr: T | undefined; done: boolean }>((r) => {
      nextResolve = r;
    });
    return {
      get value() {
        return {
          get curr() {
            return current;
          },
          get next() {
            return next;
          },
        };
      },
      update(value: T) {
        current = value;
        nextResolve?.({ curr: value, done: false });
        next = new Promise((r) => {
          nextResolve = r;
        });
        return this;
      },
      done() {
        nextResolve?.({ curr: undefined, done: true });
        return this;
      },
      append() {
        return this;
      },
      error() {
        return this;
      },
    };
  }
  async function* readStreamableValue<T>(stream: {
    curr: T | undefined;
    next: Promise<{ curr: T | undefined; done: boolean }>;
  }): AsyncGenerator<T> {
    if (stream.curr !== undefined) yield stream.curr;
    while (true) {
      const { curr, done } = await stream.next;
      if (done) return;
      if (curr !== undefined) yield curr;
    }
  }
  return { createStreamableValue, readStreamableValue };
});

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");

Object.defineProperty(dom.window, "localStorage", {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

Object.defineProperty(dom.window, "sessionStorage", {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

dom.window.matchMedia = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

global.document = dom.window.document;
global.window = dom.window as unknown as Window & typeof globalThis;
global.navigator = dom.window.navigator;
global.Element = dom.window.Element;
global.HTMLElement = dom.window.HTMLElement;
global.Text = dom.window.Text;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.localStorage = dom.window.localStorage;
global.sessionStorage = dom.window.sessionStorage;

expect.extend(matchers);

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
