/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_ADMIN_AUTH_HEADER?: string;
    readonly VITE_ADMIN_API_KEY?: string;
    readonly VITE_AUDIT_LOOKUP_LIMIT?: string;
    readonly VITE_AUTH_AUDIT_LOOKUP_LIMIT?: string;
    readonly VITE_DEV_API_PROXY_TARGET?: string;
    readonly VITE_ENABLE_MOCK_FALLBACK?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
