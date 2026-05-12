import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth';
import InputBar from '../components/InputBar';
import { getUser, saveParsedLogEntry, insertFoodEntry } from '../database';
import { parseFoodText } from '../services';
import type { ParseErrorCode } from '../services';

function getTodayDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function mapErrorToUserMessage(code: ParseErrorCode): string {
  switch (code) {
    case 'no_network':
      return 'No internet. Your entry will be saved offline.';
    case 'token_refresh_failed':
      return 'Session expired. Please sign in again.';
    case 'rate_limit_exceeded':
      return 'Daily limit reached. Try again tomorrow.';
    case 'invalid_token':
      return 'Session expired. Please sign in again.';
    case 'parse_failed':
      return "Couldn't understand that. Try rephrasing.";
    case 'llm_timeout':
      return 'Request timed out. Tap to retry.';
    case 'llm_error':
      return 'Something went wrong. Tap to retry.';
    case 'empty_result':
      return 'Nothing recognized. Try describing what you ate or did.';
    case 'server_error':
      return 'Service unavailable. Tap to retry.';
    case 'network_error':
      return 'Connection failed. Tap to retry.';
  }
}

export default function HomeScreen() {
  const auth = useAuth();
  const isDarkMode = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (auth.user) {
      getUser(auth.user.uid).then((user) => {
        if (user) userIdRef.current = user.id;
      });
    }
  }, [auth.user?.uid]);

  useEffect(() => {
    if (error !== null) {
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    }
    return () => {
      if (errorTimerRef.current !== null) clearTimeout(errorTimerRef.current);
    };
  }, [error]);

  const handleSubmit = useCallback(
    async (text: string): Promise<void> => {
      if (text.trim().length === 0) return;

      setSubmitting(true);
      setError(null);

      const result = await parseFoodText(text);

      if (result.outcome === 'success') {
        const userId = userIdRef.current;
        if (userId === null) {
          setError('User not found');
          setSubmitting(false);
          throw new Error('User not found');
        }

        try {
          await saveParsedLogEntry({
            userId,
            date: getTodayDate(),
            rawText: text,
            foods: result.foods,
            exercises: result.exercises.map((e) => ({
              exercise_type: e.type,
              duration_minutes: e.duration_minutes,
              calories_burned: e.calories_burned,
            })),
          });
        } catch {
          setError('Failed to save entry. Tap to retry.');
          setSubmitting(false);
          throw new Error('DB save failed');
        }

        setSubmitting(false);
      } else {
        if (result.error === 'no_network') {
          const userId = userIdRef.current;
          if (userId !== null) {
            try {
              await insertFoodEntry({
                user_id: userId,
                date: getTodayDate(),
                raw_text: text,
                status: 'pending',
                retry_count: 0,
                created_at: new Date().toISOString(),
              });
            } catch {
              // silently ignore pending save failure
            }
          }
        }

        const message = mapErrorToUserMessage(result.error);
        setError(message);
        setSubmitting(false);
        throw new Error(message);
      }
    },
    [],
  );

  const handleChangeText = useCallback(() => {
    setError(null);
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDarkMode && styles.containerDark]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={[styles.headerText, isDarkMode && styles.headerTextDark]}>
            Home
          </Text>
        </View>

        <View style={styles.summaryPlaceholder} />
        <View style={styles.entryListPlaceholder} />
      </View>

      {error !== null && (
        <View style={[styles.errorBanner, isDarkMode && styles.errorBannerDark]}>
          <Text
            style={[styles.errorText, isDarkMode && styles.errorTextDark]}
          >
            {error}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.inputBarWrapper,
          isDarkMode && styles.inputBarWrapperDark,
          { paddingBottom: insets.bottom },
        ]}
      >
        <InputBar
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onChangeText={handleChangeText}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
  },
  headerTextDark: {
    color: '#FFFFFF',
  },
  summaryPlaceholder: {
    flex: 1,
  },
  entryListPlaceholder: {
    flex: 2,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF3F3',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#FFCCCC',
  },
  errorBannerDark: {
    backgroundColor: '#3A1A1A',
    borderTopColor: '#662222',
  },
  errorText: {
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
  },
  errorTextDark: {
    color: '#FF4444',
  },
  inputBarWrapper: {
    backgroundColor: '#FFFFFF',
  },
  inputBarWrapperDark: {
    backgroundColor: '#1C1C1E',
  },
});
