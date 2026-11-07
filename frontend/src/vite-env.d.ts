/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Set in vite.config.ts from package.json and the build day. */
declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string
