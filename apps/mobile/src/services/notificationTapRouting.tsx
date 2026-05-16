import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import notifee, {
  EventType,
  type Event,
  type InitialNotification,
  type Notification,
} from '@notifee/react-native';

import { rootNavigationRef } from '../navigation/rootNavigation';

const MEAL_REMINDER_NOTIFICATION_KIND = 'meal-reminder';
const MEAL_REMINDER_ROUTE = 'Home';
const DUPLICATE_PRESS_WINDOW_MS = 1500;

type NotificationTapListener = (requestId: string) => void;

const listeners = new Set<NotificationTapListener>();
const queuedRequestIds: string[] = [];
let backgroundHandlerRegistered = false;
let lastPressKey: string | null = null;
let lastPressAt = 0;
let requestSequence = 0;

interface MealReminderNotificationTapRouterProps {
  enabled: boolean;
}

export function MealReminderNotificationTapRouter({
  enabled,
}: MealReminderNotificationTapRouterProps) {
  const pendingRequestIdRef = useRef<string | null>(null);
  const appIsActiveRef = useRef(AppState.currentState === 'active');

  const routeToHome = useCallback((requestId: string) => {
    if (!enabled || !appIsActiveRef.current || !rootNavigationRef.isReady()) {
      pendingRequestIdRef.current = requestId;
      return;
    }

    pendingRequestIdRef.current = null;
    rootNavigationRef.navigate('Home', {
      focusLogInputRequestId: requestId,
    });
  }, [enabled]);

  useEffect(() => subscribeToMealReminderTaps(routeToHome), [routeToHome]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appIsActiveRef.current = nextState === 'active';
      const requestId = pendingRequestIdRef.current;
      if (requestId !== null) {
        routeToHome(requestId);
      }
    });

    return () => subscription.remove();
  }, [routeToHome]);

  useEffect(() => {
    let cancelled = false;

    notifee.getInitialNotification()
      .then((initialNotification) => {
        if (cancelled) return;
        publishInitialNotificationTap(initialNotification);
      })
      .catch(() => {
        // App can still receive foreground/background press events.
      });

    const unsubscribe = notifee.onForegroundEvent((event) => {
      publishNotificationTapEvent(event);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const requestId = pendingRequestIdRef.current;
    if (requestId !== null) {
      routeToHome(requestId);
    }
  }, [enabled, routeToHome]);

  return null;
}

export function registerNotificationBackgroundTapHandler(): void {
  if (backgroundHandlerRegistered) return;

  backgroundHandlerRegistered = true;
  notifee.onBackgroundEvent(async (event) => {
    publishNotificationTapEvent(event);
  });
}

function subscribeToMealReminderTaps(
  listener: NotificationTapListener,
): () => void {
  listeners.add(listener);
  while (queuedRequestIds.length > 0) {
    const requestId = queuedRequestIds.shift();
    if (requestId !== undefined) {
      listener(requestId);
    }
  }

  return () => {
    listeners.delete(listener);
  };
}

function publishInitialNotificationTap(
  initialNotification: InitialNotification | null,
): void {
  if (initialNotification === null) return;

  publishMealReminderNotificationTap(initialNotification.notification);
}

function publishNotificationTapEvent(event: Event): void {
  if (event.type !== EventType.PRESS) return;

  publishMealReminderNotificationTap(event.detail.notification);
}

function publishMealReminderNotificationTap(notification: Notification | undefined): void {
  if (!isMealReminderNotification(notification)) return;
  if (isDuplicatePress(notification)) return;

  requestSequence += 1;
  const requestId = String(requestSequence);
  if (listeners.size === 0) {
    queuedRequestIds.push(requestId);
    return;
  }

  listeners.forEach((listener) => {
    listener(requestId);
  });
}

function isMealReminderNotification(
  notification: Notification | undefined,
): notification is Notification {
  const data = notification?.data;

  return data?.kind === MEAL_REMINDER_NOTIFICATION_KIND && data.route === MEAL_REMINDER_ROUTE;
}

function isDuplicatePress(notification: Notification): boolean {
  const now = Date.now();
  const pressKey = notification.id ?? JSON.stringify(notification.data);
  const isDuplicate =
    pressKey === lastPressKey && now - lastPressAt < DUPLICATE_PRESS_WINDOW_MS;

  lastPressKey = pressKey;
  lastPressAt = now;

  return isDuplicate;
}
