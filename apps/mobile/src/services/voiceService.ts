import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus, Platform, PermissionsAndroid } from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export type VoiceInputStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'stopped'
  | 'error';

export interface VoiceInputState {
  status: VoiceInputStatus;
  partialText: string;
  finalText: string | null;
  error: string | null;
  permissionDenied: boolean;
  isAvailable: boolean;
}

export interface VoiceInputActions {
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearFinalText: () => void;
  reset: () => void;
}

function extractLastText(e: SpeechResultsEvent): string {
  if (!e.value || e.value.length === 0) return '';
  const last = e.value[e.value.length - 1];
  return last ?? '';
}

function extractBestText(e: SpeechResultsEvent): string {
  if (!e.value || e.value.length === 0) return '';
  const best = e.value[0];
  return best ?? '';
}

export function useVoiceInput(): VoiceInputState & VoiceInputActions {
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [partialText, setPartialText] = useState('');
  const [finalText, setFinalText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const statusRef = useRef<VoiceInputStatus>('idle');
  const lastPartialRef = useRef('');
  const finalTextSetRef = useRef(false);

  const updateStatus = useCallback((next: VoiceInputStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      Voice.stop().catch(() => {});
      if (!finalTextSetRef.current) {
        setFinalText(lastPartialRef.current);
      }
      updateStatus('stopped');
    }, 5000);
  }, [clearSilenceTimer, updateStatus]);

  const stopListening = useCallback(async () => {
    clearSilenceTimer();
    try {
      await Voice.stop();
    } catch {
      // May throw if already stopped — safe to ignore
    }
    if (!isMountedRef.current) return;
    if (!finalTextSetRef.current) {
      setFinalText(lastPartialRef.current);
    }
    updateStatus('stopped');
  }, [clearSilenceTimer, updateStatus]);

  const startListening = useCallback(async () => {
    if (statusRef.current === 'listening') return;

    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        'android.permission.RECORD_AUDIO',
      );
      if (
        result === PermissionsAndroid.RESULTS.DENIED ||
        result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        if (!isMountedRef.current) return;
        setPermissionDenied(true);
        setError('Microphone access needed');
        return;
      }
    }

    try {
      const available = await Voice.isAvailable();
      if (available === 0) {
        if (!isMountedRef.current) return;
        setIsAvailable(false);
        setError(
          Platform.OS === 'android'
            ? 'Google Speech Services required'
            : 'Speech recognition unavailable',
        );
        return;
      }
    } catch {
      if (!isMountedRef.current) return;
      setIsAvailable(false);
      setError('Speech recognition unavailable');
      return;
    }

    finalTextSetRef.current = false;
    lastPartialRef.current = '';
    setPartialText('');
    setFinalText(null);
    setError(null);

    try {
      await Voice.start('en-US');
    } catch (e) {
      if (!isMountedRef.current) return;
      updateStatus('error');
      setError(
        e instanceof Error ? e.message : 'Failed to start voice recognition',
      );
    }
  }, [updateStatus]);

  const clearFinalText = useCallback(() => {
    setFinalText(null);
  }, []);

  const reset = useCallback(() => {
    clearSilenceTimer();
    updateStatus('idle');
    setPartialText('');
    setFinalText(null);
    setError(null);
    finalTextSetRef.current = false;
    lastPartialRef.current = '';
  }, [clearSilenceTimer, updateStatus]);

  useEffect(() => {
    Voice.isAvailable()
      .then((available) => {
        if (isMountedRef.current) {
          setIsAvailable(available === 1);
          if (available === 0) {
            setError(
              Platform.OS === 'android'
                ? 'Google Speech Services required'
                : 'Speech recognition unavailable',
            );
          }
        }
      })
      .catch(() => {
        if (isMountedRef.current) {
          setIsAvailable(false);
          setError(
            Platform.OS === 'android'
              ? 'Google Speech Services required'
              : 'Speech recognition unavailable',
          );
        }
      });

    Voice.onSpeechStart = () => {
      if (isMountedRef.current) {
        updateStatus('listening');
      }
    };

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      const text = extractLastText(e);
      lastPartialRef.current = text;
      setPartialText(text);
      resetSilenceTimer();
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      finalTextSetRef.current = true;
      setFinalText(extractBestText(e));
      updateStatus('stopped');
    };

    Voice.onSpeechEnd = () => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      if (!finalTextSetRef.current) {
        setFinalText(lastPartialRef.current);
      }
      updateStatus('stopped');
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      const message =
        e.error?.message ?? e.error?.code ?? 'Speech recognition error';
      setError(message);
      updateStatus('error');
    };

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'background' || nextState === 'inactive') {
          if (statusRef.current !== 'listening') return;
          if (!isMountedRef.current) return;
          clearSilenceTimer();
          Voice.stop().catch(() => {});
          if (!finalTextSetRef.current) {
            setFinalText(lastPartialRef.current);
          }
          updateStatus('stopped');
        }
      },
    );

    return () => {
      isMountedRef.current = false;
      clearSilenceTimer();
      Voice.removeAllListeners();
      subscription.remove();
    };
  }, [clearSilenceTimer, resetSilenceTimer, updateStatus]);

  return {
    status,
    partialText,
    finalText,
    error,
    permissionDenied,
    isAvailable,
    startListening,
    stopListening,
    clearFinalText,
    reset,
  };
}
