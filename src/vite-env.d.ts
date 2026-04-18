/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE_URL?: string;
	readonly VITE_RENDERER?: "canvas" | "pixi";
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

