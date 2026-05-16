const DEFAULT_PORT = 8080;
const DEFAULT_RATE_LIMIT_MAX = 50;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 86_400_000;
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-001";

type Env = NodeJS.ProcessEnv;

export interface BackendConfig {
  readonly openrouterApiKey: string | undefined;
  readonly firebaseServiceAccount: string | undefined;
  readonly firebaseProjectId: string | undefined;
  readonly rateLimitMax: number;
  readonly rateLimitWindowMs: number;
  readonly openrouterModel: string;
  readonly port: number;
  readonly nodeEnv: string;
}

export function loadConfig(env: Env = process.env): BackendConfig {
  return {
    openrouterApiKey: trimOptional(env.OPENROUTER_API_KEY),
    firebaseServiceAccount: trimOptional(env.FIREBASE_SERVICE_ACCOUNT),
    firebaseProjectId: trimOptional(env.FIREBASE_PROJECT_ID),
    rateLimitMax: parsePositiveInteger(env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    rateLimitWindowMs: parsePositiveInteger(env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    openrouterModel: trimOptional(env.OPENROUTER_MODEL) ?? DEFAULT_OPENROUTER_MODEL,
    port: parsePositiveInteger(env.PORT, DEFAULT_PORT),
    nodeEnv: trimOptional(env.NODE_ENV) ?? "development",
  };
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
