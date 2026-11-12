/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Release tag of this build (set by the release workflow). */
  readonly VITE_APP_VERSION?: string;
}
