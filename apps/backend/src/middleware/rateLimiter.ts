import { type Request, type RequestHandler } from "express";

import { type BackendConfig } from "../config.js";
import { HttpError } from "../httpError.js";
import { RateLimitError } from "../rateLimitError.js";

const CLEANUP_INTERVAL_MS = 300_000;
const IP_LIMIT_MULTIPLIER = 20;
const GLOBAL_LIMIT_MULTIPLIER = 100;

interface LimitEntry {
  readonly count: number;
  readonly windowStart: number;
}

type LimitCheck = {
  readonly allowed: true;
} | {
  readonly allowed: false;
  readonly retryAfterSeconds: number;
};

interface AuthenticatedRateLimitContext {
  readonly deviceId: string;
  readonly uid: string;
}

interface LimitRule {
  readonly key: string;
  readonly max: number;
}

interface ParseRateLimiter {
  readonly limitFlood: RequestHandler;
  readonly limitAuthenticatedUser: RequestHandler;
}

export function createParseRateLimiter(config: BackendConfig): ParseRateLimiter {
  const store = new Map<string, LimitEntry>();
  const cleanupTimer = setInterval(() => {
    cleanupExpiredEntries(store, Date.now(), config.rateLimitWindowMs);
  }, CLEANUP_INTERVAL_MS);

  cleanupTimer.unref();

  return {
    limitFlood: createRateLimitMiddleware(store, config, (request) => createFloodLimitRules(request, config)),
    limitAuthenticatedUser: createRateLimitMiddleware(store, config, (request) => createAuthenticatedLimitRules(request, config)),
  };
}

function createRateLimitMiddleware(
  store: Map<string, LimitEntry>,
  config: BackendConfig,
  createRules: (request: Request) => readonly LimitRule[] | undefined,
): RequestHandler {
  return (request, _response, next) => {
    const rules = createRules(request);

    if (rules === undefined) {
      next(new HttpError(500, "internal_error"));
      return;
    }

    const result = checkRateLimits(store, rules, Date.now(), config.rateLimitWindowMs);

    if (!result.allowed) {
      next(new RateLimitError(result.retryAfterSeconds));
      return;
    }

    next();
  };
}

function createFloodLimitRules(request: Request, config: BackendConfig): readonly LimitRule[] {
  return [
    { key: `ip:${getRequestIp(request)}`, max: config.rateLimitMax * IP_LIMIT_MULTIPLIER },
    { key: "global", max: config.rateLimitMax * GLOBAL_LIMIT_MULTIPLIER },
  ];
}

function createAuthenticatedLimitRules(request: Request, config: BackendConfig): readonly LimitRule[] | undefined {
  const context = getAuthenticatedRateLimitContext(request);

  if (context === undefined) {
    return undefined;
  }

  return [
    { key: `device:${context.deviceId}`, max: config.rateLimitMax },
    { key: `uid:${context.uid}`, max: config.rateLimitMax },
  ];
}

function getAuthenticatedRateLimitContext(request: Request): AuthenticatedRateLimitContext | undefined {
  const deviceId = request.parseRequest?.deviceId;
  const uid = request.auth?.uid;

  if (deviceId === undefined || uid === undefined) {
    return undefined;
  }

  return {
    deviceId,
    uid,
  };
}

function getRequestIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

function checkRateLimits(
  store: Map<string, LimitEntry>,
  rules: readonly LimitRule[],
  now: number,
  windowMs: number,
): LimitCheck {
  const limitedRule = rules.find((rule) => isLimitExceeded(store.get(rule.key), rule.max, now, windowMs));

  if (limitedRule !== undefined) {
    return {
      allowed: false,
      retryAfterSeconds: getRetryAfterSeconds(getLimitEntry(store, limitedRule.key, now), now, windowMs),
    };
  }

  rules.forEach((rule) => {
    incrementLimit(store, rule.key, now, windowMs);
  });

  return { allowed: true };
}

function isLimitExceeded(entry: LimitEntry | undefined, max: number, now: number, windowMs: number): boolean {
  return entry !== undefined && !isExpired(entry, now, windowMs) && entry.count >= max;
}

function getLimitEntry(store: Map<string, LimitEntry>, key: string, now: number): LimitEntry {
  return store.get(key) ?? { count: 0, windowStart: now };
}

function incrementLimit(store: Map<string, LimitEntry>, key: string, now: number, windowMs: number): void {
  const entry = store.get(key);

  if (entry === undefined || isExpired(entry, now, windowMs)) {
    store.set(key, { count: 1, windowStart: now });
    return;
  }

  store.set(key, { count: entry.count + 1, windowStart: entry.windowStart });
}

function cleanupExpiredEntries(store: Map<string, LimitEntry>, now: number, windowMs: number): void {
  for (const [key, entry] of store) {
    if (isExpired(entry, now, windowMs)) {
      store.delete(key);
    }
  }
}

function isExpired(entry: LimitEntry, now: number, windowMs: number): boolean {
  return now - entry.windowStart >= windowMs;
}

function getRetryAfterSeconds(entry: LimitEntry, now: number, windowMs: number): number {
  return Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1_000));
}
