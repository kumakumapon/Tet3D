import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
const { version } = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
};
function commit() {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: "pipe" })
      .toString()
      .trim();
  } catch {
    return "nogit";
  }
}
// Unique per build, so every deploy is detected even without a version bump.
const build = `${version}-${commit()}-${Date.now().toString(36)}`;
/** Emits version.json, which running clients poll to detect a newer deploy. */
function versionFile(): Plugin {
  return {
    name: "cube-cascade-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version, build }),
      });
    },
  };
}
export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_ID__: JSON.stringify(build),
  },
  plugins: [versionFile()],
});
