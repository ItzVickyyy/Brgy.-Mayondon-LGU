import { execFileSync } from "node:child_process"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, type Plugin } from "vite"

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"),
) as { version: string }

// Which release this build is. build-info.json carries "$Format:...$" markers that Git fills in when
// the release archive is made (.gitattributes: export-subst), so a copy built on the office computer,
// which has no .git folder, still knows its commit. A normal clone keeps the markers, so there the
// commit comes from Git itself; with neither, the build says "unknown" rather than guessing.
function readBuildInfo(): { commit: string; released: string } {
  let marked = { commit: "", released: "" }
  try {
    marked = JSON.parse(
      fs.readFileSync(
        path.resolve(import.meta.dirname, "build-info.json"),
        "utf-8",
      ),
    ) as typeof marked
  } catch {
    // no file: fall through to Git
  }
  const filled = (value: string) =>
    /^[0-9a-f]{7,40}$|^\d{4}-\d{2}-\d{2}$/.test(value)
  const git = (...args: string[]) => {
    try {
      return execFileSync("git", args, {
        cwd: import.meta.dirname,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    } catch {
      return ""
    }
  }
  return {
    commit: filled(marked.commit)
      ? marked.commit
      : git("rev-parse", "--short", "HEAD") || "unknown",
    released: filled(marked.released)
      ? marked.released
      : git("log", "-1", "--format=%cs") || "",
  }
}
const buildInfo = readBuildInfo()

// The photo step removes the background from resident photos on this computer, so the files of the
// MediaPipe selfie-segmentation package (model + WebAssembly, Apache-2.0, about 12 MB) are served
// from our own server at /vision/selfie-segmentation/. Nothing is fetched from the internet and no
// resident photo ever leaves the browser. The files stay in node_modules and are not committed.
const SELFIE_URL_PATH = "/vision/selfie-segmentation/"
const SELFIE_FILES = [
  "selfie_segmentation.js",
  "selfie_segmentation.binarypb",
  "selfie_segmentation.tflite",
  "selfie_segmentation_solution_simd_wasm_bin.js",
  "selfie_segmentation_solution_simd_wasm_bin.wasm",
  "selfie_segmentation_solution_simd_wasm_bin.data",
  "selfie_segmentation_solution_wasm_bin.js",
  "selfie_segmentation_solution_wasm_bin.wasm",
]
const SELFIE_TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".wasm": "application/wasm",
}

function selfieSegmentationAssets(): Plugin {
  const packageDir = path.dirname(
    createRequire(import.meta.url).resolve(
      "@mediapipe/selfie_segmentation/package.json",
    ),
  )
  return {
    name: "selfie-segmentation-assets",
    configureServer(server) {
      server.middlewares.use(SELFIE_URL_PATH, (request, response, next) => {
        const name = decodeURIComponent(
          (request.url ?? "").split("?")[0],
        ).replace(/^\//, "")
        if (!SELFIE_FILES.includes(name)) return next()
        response.setHeader(
          "Content-Type",
          SELFIE_TYPES[path.extname(name)] ?? "application/octet-stream",
        )
        fs.createReadStream(path.join(packageDir, name)).pipe(response)
      })
    },
    generateBundle() {
      for (const name of SELFIE_FILES) {
        this.emitFile({
          type: "asset",
          fileName: `${SELFIE_URL_PATH.slice(1)}${name}`,
          source: fs.readFileSync(path.join(packageDir, name)),
        })
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    __APP_COMMIT__: JSON.stringify(buildInfo.commit),
    __APP_RELEASED__: JSON.stringify(buildInfo.released),
  },
  build: {
    // Local/self-hosted builds share the frontend with FastAPI. On Vercel set
    // VITE_BUILD_OUT_DIR=dist in the frontend project settings.
    outDir: process.env.VITE_BUILD_OUT_DIR || "../backend/app/frontend",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    selfieSegmentationAssets(),
  ],
})
