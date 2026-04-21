// test-setup.ts
import "@/envConfig";

import * as matchers from '@testing-library/jest-dom/matchers';
import { plugin } from "bun";
import { beforeAll, beforeEach } from "bun:test";
import { expect } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { JSDOM } from 'jsdom';

import { db as testdb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { matterBunLoader } from "@/loader/matter";

// Setup JSDOM for React component testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

// Add missing browser APIs
Object.defineProperty(dom.window, 'localStorage', {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

Object.defineProperty(dom.window, 'sessionStorage', {
  value: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  },
  writable: true,
});

// Add matchMedia polyfill
dom.window.matchMedia = () => ({
  matches: false,
  media: '',
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

// Extend expect with jest-dom matchers
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

  await testdb.delete(schema.messages);
  await testdb.delete(schema.chat);
  await testdb.delete(schema.session);
  await testdb.delete(schema.account);
  await testdb.delete(schema.user);

  // Better Auth tables will be cleared when needed in tests
  // user, session, account, verification are created by Better Auth migrations
});
