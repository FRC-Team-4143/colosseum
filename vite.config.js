import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";

/** Build-time commit stamp. */
function getGitCommitInfo() {
  const REPO_URL = "https://github.com/FRC-Team-4143/colosseum";
  try {
    /** @param {string} cmd */
    const git = (cmd) => execSync(`git ${cmd}`, { encoding: "utf-8" }).trim();
    const fullSha = git("rev-parse HEAD");
    return {
      sha: git("rev-parse --short HEAD"),
      fullSha,
      message: git("log -1 --format=%s"),
      author: git("log -1 --format=%an"),
      date: new Date(Number(git("log -1 --format=%at")) * 1000).toISOString(),
      url: `${REPO_URL}/commit/${fullSha}`,
    };
  } catch {
    return { sha: "dev", fullSha: "dev", message: "Development build", author: "Unknown", date: new Date().toISOString(), url: REPO_URL };
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [tailwindcss(), sveltekit()],

  define: {
    __BUILD_COMMIT__: JSON.stringify(getGitCommitInfo()),
  },

  // The FastAPI backend (server/) owns port 8005 in dev; Vite serves the SPA on
  // 5173 and proxies /api to it. `host: true` keeps the dev server LAN-visible
  // (e.g. for testing from an iPad on the same network).
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": "http://localhost:8005",
    },
  },
}));
