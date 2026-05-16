import { type BackendConfig } from "./config.js";
import { HttpError } from "./httpError.js";
import { getErrorContext, logError, logWarn } from "./logger.js";
import { parseNutritionResponse, type ParsedNutrition } from "./parseResponse.js";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_REFERER = "https://calories-api.fly.dev";
const OPENROUTER_TITLE = "Calories App";
const OPENROUTER_TIMEOUT_MS = 10_000;
const OPENROUTER_MAX_TOKENS = 1_500;
const OPENROUTER_TEMPERATURE = 0.1;
const NUTRITION_PARSER_SYSTEM_PROMPT = [
  "You are a nutrition parser.",
  "Given a freeform text description of food and/or exercise, return a JSON object with two arrays: foods and exercises.",
  "For each food item return name, calories, protein_g, carbs_g, and fat_g.",
  "For each exercise return type, duration_minutes, and calories_burned.",
  "If nothing is recognized, return empty arrays.",
  "Output only valid JSON, no markdown, no explanation.",
].join(" ");

interface ChatCompletionResponse {
  readonly choices?: readonly Choice[];
}

interface Choice {
  readonly message?: {
    readonly content?: unknown;
  };
}

export interface OpenRouterClient {
  readonly parseNutrition: (prompt: string) => Promise<ParsedNutrition>;
}

export function createOpenRouterClient(config: BackendConfig): OpenRouterClient {
  return {
    parseNutrition: (prompt) => parseNutrition(config, prompt),
  };
}

async function parseNutrition(config: BackendConfig, prompt: string): Promise<ParsedNutrition> {
  const response = await fetchOpenRouter(config, prompt);
  const completion = await parseCompletionResponse(response);
  return parseNutritionResponse(extractContent(completion));
}

async function fetchOpenRouter(config: BackendConfig, prompt: string): Promise<Response> {
  const apiKey = requireOpenRouterApiKey(config);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: createOpenRouterHeaders(apiKey),
      body: JSON.stringify(createOpenRouterBody(config.openrouterModel, prompt)),
      signal: controller.signal,
    });

    if (response.status !== 200) {
      logOpenRouterStatusError(response.status);
      throw mapOpenRouterError(response.status);
    }

    return response;
  } catch (error) {
    throw mapFetchError(error, controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

function requireOpenRouterApiKey(config: BackendConfig): string {
  if (config.openrouterApiKey === undefined) {
    throw new HttpError(503, "llm_unavailable", "OpenRouter API key is not configured.");
  }

  return config.openrouterApiKey;
}

function createOpenRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": OPENROUTER_REFERER,
    "X-Title": OPENROUTER_TITLE,
  };
}

function createOpenRouterBody(model: string, prompt: string): object {
  return {
    model,
    messages: [
      {
        role: "system",
        content: NUTRITION_PARSER_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: OPENROUTER_TEMPERATURE,
    max_tokens: OPENROUTER_MAX_TOKENS,
    response_format: { type: "json_object" },
  };
}

async function parseCompletionResponse(response: Response): Promise<ChatCompletionResponse> {
  try {
    const body: unknown = await response.json();
    return isObject(body) ? body : {};
  } catch (error) {
    logWarn("openrouter_malformed_json", getErrorContext(error));
    throw new HttpError(502, "llm_error", "OpenRouter returned invalid JSON.");
  }
}

function extractContent(response: ChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new HttpError(502, "llm_error", "OpenRouter response content is missing.");
  }

  return content;
}

function mapOpenRouterError(statusCode: number): HttpError {
  const details = statusCode === 401 || statusCode === 403 ? "upstream_auth_failed" : undefined;
  return new HttpError(502, "llm_error", details);
}

function mapFetchError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted || isAbortError(error)) {
    logWarn("openrouter_timeout", {
      timeout_ms: OPENROUTER_TIMEOUT_MS,
    });
    return new HttpError(504, "llm_timeout");
  }

  logError("openrouter_request_failed", getErrorContext(error));
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isObject(value: unknown): value is ChatCompletionResponse {
  return typeof value === "object" && value !== null;
}

function logOpenRouterStatusError(statusCode: number): void {
  logWarn("openrouter_status_error", {
    upstream_status: statusCode,
    reason: statusCode === 401 || statusCode === 403 ? "upstream_auth_failed" : "upstream_error",
  });
}
