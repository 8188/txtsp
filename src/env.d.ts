/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_COZE_TOKEN?: string;
  readonly PUBLIC_COZE_API_BASE?: string;
  readonly PUBLIC_COZE_ENCOURAGE_WORKFLOW_ID?: string;
  readonly PUBLIC_COZE_ARTWORK_WORKFLOW_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
