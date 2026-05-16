import { HttpError } from "./httpError.js";

interface ParsedFood {
  readonly name: string;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
}

interface ParsedExercise {
  readonly type: string;
  readonly duration_minutes: number;
  readonly calories_burned: number;
}

export interface ParsedNutrition {
  readonly foods: readonly ParsedFood[];
  readonly exercises: readonly ParsedExercise[];
}

const JSON_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
const NUMERIC_PRECISION = 1;
const RESPONSE_TRUNCATED_REASON = "response_truncated";

export function parseNutritionResponse(content: string): ParsedNutrition {
  const jsonText = normalizeJsonText(content);

  try {
    return sanitizeNutritionResponse(JSON.parse(jsonText) as unknown);
  } catch (error) {
    throw mapParseError(error, jsonText);
  }
}

function normalizeJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = JSON_FENCE_PATTERN.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

function sanitizeNutritionResponse(value: unknown): ParsedNutrition {
  if (!isObject(value) || !Array.isArray(value.foods) || !Array.isArray(value.exercises)) {
    throw createParseError("invalid_structure");
  }

  return {
    foods: value.foods.map(sanitizeFood),
    exercises: value.exercises.map(sanitizeExercise),
  };
}

function sanitizeFood(value: unknown): ParsedFood {
  if (!isObject(value) || typeof value.name !== "string" || !hasNumberFields(value, ["calories", "protein_g", "carbs_g", "fat_g"])) {
    throw createParseError("invalid_structure");
  }

  return {
    name: value.name.trim(),
    calories: sanitizeNumber(value.calories),
    protein_g: sanitizeNumber(value.protein_g),
    carbs_g: sanitizeNumber(value.carbs_g),
    fat_g: sanitizeNumber(value.fat_g),
  };
}

function sanitizeExercise(value: unknown): ParsedExercise {
  if (!isObject(value) || typeof value.type !== "string" || !hasNumberFields(value, ["duration_minutes", "calories_burned"])) {
    throw createParseError("invalid_structure");
  }

  return {
    type: value.type.trim(),
    duration_minutes: sanitizeNumber(value.duration_minutes),
    calories_burned: sanitizeNumber(value.calories_burned),
  };
}

function hasNumberFields(value: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every((field) => typeof value[field] === "number" && Number.isFinite(value[field]));
}

function sanitizeNumber(value: unknown): number {
  return round(Math.max(0, value as number));
}

function round(value: number): number {
  const multiplier = 10 ** NUMERIC_PRECISION;
  return Math.round(value * multiplier) / multiplier;
}

function mapParseError(error: unknown, jsonText: string): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  return createParseError(isDetectablyTruncated(jsonText) ? RESPONSE_TRUNCATED_REASON : "invalid_json");
}

function isDetectablyTruncated(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") {
    return false;
  }

  return hasUnclosedJsonBoundary(trimmed) || hasUnclosedMarkdownFence(trimmed);
}

function hasUnclosedJsonBoundary(value: string): boolean {
  return ["{", "[", ",", ":"].some((suffix) => value.endsWith(suffix)) || !hasMatchingJsonBoundary(value);
}

function hasMatchingJsonBoundary(value: string): boolean {
  return (value.startsWith("{") && value.endsWith("}")) || (value.startsWith("[") && value.endsWith("]"));
}

function hasUnclosedMarkdownFence(value: string): boolean {
  return value.startsWith("```") && !value.endsWith("```");
}

function createParseError(reason: string): HttpError {
  return new HttpError(502, "parse_failed", undefined, reason);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
