/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Set in vite.config.ts from package.json, the release commit (build-info.json or Git) and the build day. */
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
/** Short commit of the release, or "unknown" when the build could not tell. */
declare const __APP_COMMIT__: string
/** Date of that commit (YYYY-MM-DD), or "" when unknown. */
declare const __APP_RELEASED__: string
