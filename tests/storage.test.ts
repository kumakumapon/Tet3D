import { afterEach, expect, it, vi } from "vitest";
import { GameStorage } from "../src/storage/storage";
afterEach(() => vi.unstubAllGlobals());
it("persists best and ignores lower scores", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  const store = new GameStorage();
  store.record(120);
  store.record(40);
  expect(new GameStorage().score).toBe(120);
});
it.each(["NaN", "-1", "Infinity", "2.5"])(
  "rejects corrupt best %s",
  (value) => {
    vi.stubGlobal("localStorage", { getItem: () => value });
    expect(new GameStorage().score).toBe(0);
  },
);
it("survives unavailable localStorage", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  });
  const store = new GameStorage();
  store.record(40);
  expect(store.score).toBe(40);
});
