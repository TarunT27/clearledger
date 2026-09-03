/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path for the API, e.g. "/api/v1" behind the nginx proxy. */
  readonly VITE_API_BASE_URL?: string
  /** Shown under the wordmark, e.g. "Demo environment". */
  readonly VITE_ENVIRONMENT_LABEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
