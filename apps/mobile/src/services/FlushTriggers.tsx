import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { flushQueue } from './queueFlusher';
import { getSetting, setSetting } from '../database';

export function FlushTriggers() {
  useEffect(() => {
    let rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRateLimitRetry = async () => {
      if (rateLimitTimer !== null) {
        clearTimeout(rateLimitTimer);
        rateLimitTimer = null;
      }
      const resetAt = await getSetting('rate_limit_reset_at');
      if (!resetAt) return;
      const delay = new Date(resetAt).getTime() - Date.now();
      if (delay <= 0) {
        flushAndHandleRateLimit();
        return;
      }
      rateLimitTimer = setTimeout(() => {
        flushAndHandleRateLimit();
      }, delay);
    };

    const flushAndHandleRateLimit = async () => {
      const result = await flushQueue();
      if (result.stoppedReason === 'rate_limit') {
        scheduleRateLimitRetry();
      }
    };

    const throttledFlush = async () => {
      const lastFlush = await getSetting('last_flush_timestamp');
      if (lastFlush) {
        const elapsed = Date.now() - new Date(lastFlush).getTime();
        if (elapsed < 30_000) return;
      }
      await setSetting('last_flush_timestamp', new Date().toISOString());
      await flushAndHandleRateLimit();
    };

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        throttledFlush();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        throttledFlush();
      }
    });

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
      if (rateLimitTimer !== null) {
        clearTimeout(rateLimitTimer);
      }
    };
  }, []);

  // TODO: periodic health check — setInterval every 15 min that checks
  // getPendingEntries() and triggers flush if entries exist

  return null;
}
