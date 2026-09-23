import { afterEach, expect, it, vi } from "vitest";
import {
  UpdateWatcher,
  claimAutoReload,
  cleanUrl,
  fetchLatest,
  reloadUrl,
} from "../src/update/update";
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
it("fetches version.json without any cache", async () => {
  const fetcher = vi.fn(() => json({ version: "0.2.0", build: "b2" }));
  expect(await fetchLatest("./version.json", fetcher)).toEqual({
    version: "0.2.0",
    build: "b2",
  });
  const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toMatch(/^\.\/version\.json\?t=\d+$/);
  expect(init.cache).toBe("no-store");
});
it.each([
  ["http error", () => json({ version: "1", build: "b" }, false)],
  ["malformed body", () => json({ build: 3 })],
  ["network failure", () => Promise.reject(Error("offline"))],
])("ignores %s", async (_, fetcher) => {
  expect(await fetchLatest("./version.json", fetcher)).toBeNull();
});
it("adds and removes the cache-busting parameter, keeping others", () => {
  const next = reloadUrl("https://x.test/game/?e2e=1#a", "b2");
  expect(next).toBe("https://x.test/game/?e2e=1&v=b2#a");
  expect(cleanUrl(next)).toBe("https://x.test/game/?e2e=1#a");
  expect(cleanUrl("https://x.test/game/")).toBeNull();
});
it("claims one automatic reload per build", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  });
  expect(claimAutoReload("b2")).toBe(true);
  expect(claimAutoReload("b2")).toBe(false);
  expect(claimAutoReload("b3")).toBe(true);
});
it("refuses automatic reload without sessionStorage", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => {
      throw Error("denied");
    },
  });
  expect(claimAutoReload("b2")).toBe(false);
});
it("notifies once, only for a different build", async () => {
  let build = "b1";
  const onUpdate = vi.fn();
  const watcher = new UpdateWatcher(
    "b1",
    () => Promise.resolve({ version: "0.1.0", build }),
    onUpdate,
  );
  await watcher.check();
  expect(onUpdate).not.toHaveBeenCalled();
  build = "b2";
  await Promise.all([watcher.check(), watcher.check()]);
  await watcher.check();
  expect(onUpdate).toHaveBeenCalledTimes(1);
  expect(onUpdate).toHaveBeenCalledWith({ version: "0.1.0", build: "b2" });
});
