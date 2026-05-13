import auth from '@react-native-firebase/auth';
import { fetch } from '@react-native-community/netinfo';
import { parseFoodText } from './llmService';
import type { ParseResult } from './llmService';
import {
  getPendingEntries,
  completePendingEntry,
  incrementRetryCount,
  updateFoodEntryStatus,
  setSetting,
} from '../database';

let isFlushing = false;

interface FlushResult {
  successCount: number;
  failureCount: number;
  stoppedReason?: 'rate_limit' | 'auth' | 'batch_limit';
}

export async function flushQueue(): Promise<FlushResult> {
  if (isFlushing) return { successCount: 0, failureCount: 0 };

  isFlushing = true;
  try {
    const netState = await fetch();
    if (netState.isInternetReachable === false) {
      return { successCount: 0, failureCount: 0 };
    }

    const entries = await getPendingEntries();
    if (entries.length === 0) return { successCount: 0, failureCount: 0 };

    const currentUser = auth().currentUser;
    if (!currentUser) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      await currentUser.getIdToken();
    } catch {
      return { successCount: 0, failureCount: 0 };
    }

    const batch = entries.slice(0, 10);
    let successCount = 0;
    let failureCount = 0;
    let stoppedReason: 'rate_limit' | 'auth' | 'batch_limit' | undefined;

    for (const entry of batch) {
      const result: ParseResult = await parseFoodText(entry.raw_text, {
        skipConnectivityCheck: true,
      });

      if (result.outcome === 'success') {
        await completePendingEntry(
          entry.id,
          entry.user_id,
          entry.date,
          result.foods,
          result.exercises.map((e) => ({
            exercise_type: e.type,
            duration_minutes: e.duration_minutes,
            calories_burned: e.calories_burned,
          })),
        );
        successCount++;
        continue;
      }

      if (result.error === 'rate_limit_exceeded') {
        const resetTime = result.retryAfterMs
          ? new Date(Date.now() + result.retryAfterMs).toISOString()
          : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        await setSetting('rate_limit_reset_at', resetTime);
        stoppedReason = 'rate_limit';
        break;
      }

      if (result.error === 'token_refresh_failed' || result.error === 'invalid_token') {
        stoppedReason = 'auth';
        break;
      }

      await incrementRetryCount(entry.id);
      failureCount++;

      if (entry.retry_count + 1 >= 3) {
        await updateFoodEntryStatus(entry.id, 'failed');
      }
    }

    await setSetting('last_flush_timestamp', new Date().toISOString());

    if (!stoppedReason && entries.length > 10) {
      stoppedReason = 'batch_limit';
    }

    const result: FlushResult = { successCount, failureCount };
    if (stoppedReason !== undefined) {
      result.stoppedReason = stoppedReason;
    }
    return result;
  } finally {
    isFlushing = false;
  }
}
