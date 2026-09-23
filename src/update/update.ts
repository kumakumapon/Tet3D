export interface VersionInfo {
  version: string;
  build: string;
}
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
const RELOADED_KEY = "cube-cascade.reloadedFor";
/** Reads the deployed version, bypassing every HTTP cache layer. */
export async function fetchLatest(
  url: string,
  fetcher: Fetcher = fetch,
): Promise<VersionInfo | null> {
  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetcher(`${url}${sep}t=${Date.now()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      typeof data === "object" &&
      data !== null &&
      typeof (data as VersionInfo).build === "string" &&
      typeof (data as VersionInfo).version === "string"
    )
      return data as VersionInfo;
  } catch {
    /* Offline or not deployed with version.json: keep the running build. */
  }
  return null;
}
/** A new query string forces a fresh index.html even from browser/CDN caches. */
export function reloadUrl(href: string, build: string) {
  const url = new URL(href);
  url.searchParams.set("v", build);
  return url.toString();
}
/** Removes the cache-busting parameter after a successful update. */
export function cleanUrl(href: string) {
  const url = new URL(href);
  if (!url.searchParams.has("v")) return null;
  url.searchParams.delete("v");
  return url.toString();
}
/**
 * Allows one automatic reload per build so a stale cache that still serves the
 * old page cannot cause a reload loop. Without sessionStorage no guard exists,
 * so automatic reloads are refused and the user decides.
 */
export function claimAutoReload(build: string) {
  try {
    if (sessionStorage.getItem(RELOADED_KEY) === build) return false;
    sessionStorage.setItem(RELOADED_KEY, build);
    return true;
  } catch {
    return false;
  }
}
export class UpdateWatcher {
  private pending: Promise<void> | null = null;
  private found = false;
  constructor(
    private readonly current: string,
    private readonly latest: () => Promise<VersionInfo | null>,
    private readonly onUpdate: (info: VersionInfo) => void,
  ) {}
  check() {
    if (this.found) return Promise.resolve();
    this.pending ??= this.latest()
      .then((info) => {
        if (info && info.build !== this.current && !this.found) {
          this.found = true;
          this.onUpdate(info);
        }
      })
      .finally(() => (this.pending = null));
    return this.pending;
  }
}
