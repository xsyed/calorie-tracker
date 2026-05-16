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
  "Given freeform text describing food and/or exercise, return a JSON object with two arrays: foods and exercises.",
  "For each food item return name, calories, protein_g, carbs_g, and fat_g.",
  "For each exercise return type, duration_minutes, and calories_burned.",
  "Infer missing exercise fields from prompt context instead of omitting the exercise.",
  "Treat steps as walking exercise and estimate duration from common adult walking pace.",
  "If exercise duration is missing, estimate it from context or common adult averages.",
  "If calories burned are missing, estimate them from common adult averages.",
  "Mixed food and exercise prompts must return both arrays.",
  "Do not return empty exercises for clear exercise prompts such as walking steps, weight training, HIIT, cycling, running, or workouts.",
  "If nothing is recognized, return empty arrays.",
  "Output only valid JSON, no markdown, no explanation.",
].join(" ");
const NUTRITION_RESPONSE_SCHEMA = {
  name: "nutrition_parse",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["foods", "exercises"],
    properties: {
      foods: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "calories", "protein_g", "carbs_g", "fat_g"],
          properties: {
            name: { type: "string" },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
          },
        },
      },
      exercises: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "duration_minutes", "calories_burned"],
          properties: {
            type: { type: "string" },
            duration_minutes: { type: "number" },
            calories_burned: { type: "number" },
          },
        },
      },
    },
  },
} as const;
const NUTRITION_PARSER_EXAMPLES = [
  {
    prompt: "I walked 3000 steps",
    response: {
      foods: [],
      exercises: [{ type: "walking", duration_minutes: 30, calories_burned: 120 }],
    },
  },
  {
    prompt: "I ate kfc chicken burger and walked 5000 steps",
    response: {
      foods: [{ name: "KFC chicken burger", calories: 450, protein_g: 25, carbs_g: 40, fat_g: 22 }],
      exercises: [{ type: "walking", duration_minutes: 50, calories_burned: 200 }],
    },
  },
  {
    prompt: "I ate chicken biryani and weight training for chest and triceps for 1 hour",
    response: {
      foods: [{ name: "chicken biryani", calories: 650, protein_g: 35, carbs_g: 75, fat_g: 22 }],
      exercises: [{ type: "weight training", duration_minutes: 60, calories_burned: 240 }],
    },
  },
  {
    prompt: "I did weight training for 1 hour and 15 minutes of HIIT cycling",
    response: {
      foods: [],
      exercises: [
        { type: "weight training", duration_minutes: 60, calories_burned: 240 },
        { type: "HIIT cycling", duration_minutes: 15, calories_burned: 160 },
      ],
    },
  },
] as const;

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
      ...NUTRITION_PARSER_EXAMPLES.flatMap((example) => [
        {
          role: "user",
          content: example.prompt,
        },
        {
          role: "assistant",
          content: JSON.stringify(example.response),
        },
      ]),
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: OPENROUTER_TEMPERATURE,
    max_tokens: OPENROUTER_MAX_TOKENS,
    response_format: {
      type: "json_schema",
      json_schema: NUTRITION_RESPONSE_SCHEMA,
    },
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
