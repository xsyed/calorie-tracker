import auth from '@react-native-firebase/auth';
import { checkConnectivity } from './connectivity';
import { getSetting, setSetting } from '../database';

const API_BASE_URL = 'https://calories-api.fly.dev';
const FETCH_TIMEOUT_MS = 10_000;
const MACRO_TOLERANCE_KCAL = 20;
const DEVICE_ID_KEY = 'device_id';

export interface ParsedFood {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ParsedExercise {
  type: string;
  duration_minutes: number;
  calories_burned: number;
}

export interface ParseSuccess {
  outcome: 'success';
  foods: ParsedFood[];
  exercises: ParsedExercise[];
}

export type ParseErrorCode =
  | 'no_network'
  | 'token_refresh_failed'
  | 'rate_limit_exceeded'
  | 'invalid_token'
  | 'parse_failed'
  | 'llm_timeout'
  | 'llm_error'
  | 'empty_result'
  | 'server_error'
  | 'network_error';

export interface ParseFailure {
  outcome: 'error';
  error: ParseErrorCode;
  message: string;
  retryAfterMs?: number;
}

export type ParseResult = ParseSuccess | ParseFailure;

interface ParseRequest {
  prompt: string;
  device_id: string;
}

function generateDeviceId(): string {
  const random = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now().toString(36);
  return `${random}${timestamp}`;
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getSetting(DEVICE_ID_KEY);
  if (existing) return existing;
  const newId = generateDeviceId();
  await setSetting(DEVICE_ID_KEY, newId);
  return newId;
}

function validateMacros(food: ParsedFood): ParsedFood {
  const computed = food.protein_g * 4 + food.carbs_g * 4 + food.fat_g * 9;
  if (Math.abs(computed - food.calories) > MACRO_TOLERANCE_KCAL) {
    console.warn(
      `Macro mismatch: ${food.name} reported ${food.calories} kcal, ` +
        `computed ${computed} kcal (P:${food.protein_g}g C:${food.carbs_g}g F:${food.fat_g}g). ` +
        `Overriding to computed value.`,
    );
    return { ...food, calories: computed };
  }
  return food;
}

async function doFetch(
  prompt: string,
  deviceId: string,
  token: string,
  signal: AbortSignal,
): Promise<Response> {
  const body: ParseRequest = { prompt, device_id: deviceId };
  return fetch(`${API_BASE_URL}/api/parse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseFoodItem(item: unknown): ParsedFood | null {
  if (!isObject(item)) return null;
  if (
    typeof item.name !== 'string' ||
    typeof item.calories !== 'number' ||
    typeof item.protein_g !== 'number' ||
    typeof item.carbs_g !== 'number' ||
    typeof item.fat_g !== 'number'
  ) {
    return null;
  }
  return {
    name: item.name,
    calories: item.calories,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
  };
}

function parseExerciseItem(item: unknown): ParsedExercise | null {
  if (!isObject(item)) return null;
  if (
    typeof item.type !== 'string' ||
    typeof item.duration_minutes !== 'number' ||
    typeof item.calories_burned !== 'number'
  ) {
    return null;
  }
  return {
    type: item.type,
    duration_minutes: item.duration_minutes,
    calories_burned: item.calories_burned,
  };
}

async function fetchWithTimeout(
  prompt: string,
  deviceId: string,
  token: string,
): Promise<{ response: Response } | { error: ParseFailure }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await doFetch(prompt, deviceId, token, controller.signal);
    return { response };
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        error: { outcome: 'error', error: 'network_error', message: 'Request timed out' },
      };
    }
    return {
      error: {
        outcome: 'error',
        error: 'network_error',
        message: err instanceof Error ? err.message : 'Network error',
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function parseFoodText(
  prompt: string,
  options?: { skipConnectivityCheck?: boolean },
): Promise<ParseResult> {
  if (!options?.skipConnectivityCheck) {
    const isConnected = await checkConnectivity();
    if (!isConnected) {
      return { outcome: 'error', error: 'no_network', message: 'No network connection' };
    }
  }

  const deviceId = await getOrCreateDeviceId();

  const currentUser = auth().currentUser;
  if (!currentUser) {
    return {
      outcome: 'error',
      error: 'token_refresh_failed',
      message: 'No authenticated user',
    };
  }

  let token: string;
  try {
    token = await currentUser.getIdToken();
  } catch {
    return {
      outcome: 'error',
      error: 'token_refresh_failed',
      message: 'Failed to get ID token',
    };
  }

  const firstAttempt = await fetchWithTimeout(prompt, deviceId, token);
  if ('error' in firstAttempt) return firstAttempt.error;

  let response = firstAttempt.response;

  if (response.status === 401 || response.status === 403) {
    try {
      token = await currentUser.getIdToken(true);
    } catch {
      return {
        outcome: 'error',
        error: 'invalid_token',
        message: 'Token refresh failed',
      };
    }

    const retryAttempt = await fetchWithTimeout(prompt, deviceId, token);
    if ('error' in retryAttempt) return retryAttempt.error;

    response = retryAttempt.response;

    if (response.status === 401 || response.status === 403) {
      return {
        outcome: 'error',
        error: 'invalid_token',
        message: 'Invalid token after refresh',
      };
    }
  }

  if (response.status !== 200) {
    switch (response.status) {
      case 429: {
        const retryAfterHeader = response.headers.get('Retry-After');
        let retryAfterMs: number | undefined;
        if (retryAfterHeader) {
          const deltaSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(deltaSeconds)) {
            retryAfterMs = deltaSeconds * 1000;
          } else {
            const dateVal = Date.parse(retryAfterHeader);
            if (!isNaN(dateVal)) {
              retryAfterMs = Math.max(0, dateVal - Date.now());
            }
          }
        }
        const rateLimitResult: ParseFailure = {
          outcome: 'error',
          error: 'rate_limit_exceeded',
          message: 'Rate limit exceeded',
        };
        if (retryAfterMs !== undefined) {
          rateLimitResult.retryAfterMs = retryAfterMs;
        }
        return rateLimitResult;
      }
      case 502:
        return { outcome: 'error', error: 'llm_error', message: 'LLM error' };
      case 504:
        return { outcome: 'error', error: 'llm_timeout', message: 'LLM timeout' };
      default:
        if (response.status >= 500) {
          return {
            outcome: 'error',
            error: 'server_error',
            message: `Server error: ${response.status}`,
          };
        }
        return {
          outcome: 'error',
          error: 'server_error',
          message: `Unexpected status: ${response.status}`,
        };
    }
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { outcome: 'error', error: 'parse_failed', message: 'Invalid JSON response' };
  }

  if (!isObject(body)) {
    return { outcome: 'error', error: 'parse_failed', message: 'Invalid response structure' };
  }

  if (!Array.isArray(body.foods) || !Array.isArray(body.exercises)) {
    return { outcome: 'error', error: 'parse_failed', message: 'Invalid response structure' };
  }

  const foods = body.foods.map(parseFoodItem).filter((f): f is ParsedFood => f !== null);
  const exercises = body.exercises
    .map(parseExerciseItem)
    .filter((e): e is ParsedExercise => e !== null);

  if (foods.length === 0 && exercises.length === 0) {
    return { outcome: 'error', error: 'empty_result', message: 'No food or exercise items found' };
  }

  const validatedFoods = foods.map(validateMacros);

  return { outcome: 'success', foods: validatedFoods, exercises };
}
