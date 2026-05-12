import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import WaveformIndicator from './WaveformIndicator';

export interface InputBarHandle {
  setText: (text: string) => void;
}

interface InputBarProps {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
  onChangeText?: (text: string) => void;
  voiceStatus?: 'idle' | 'listening' | 'processing' | 'stopped' | 'error';
  voicePartialText?: string;
  voiceError?: string | null;
  isVoiceAvailable?: boolean;
  onMicPress?: () => void;
}

function MicIcon({ color }: { color: string }) {
  return (
    <View style={micStyles.container}>
      <View style={[micStyles.head, { backgroundColor: color }]} />
      <View style={[micStyles.body, { backgroundColor: color }]} />
      <View style={[micStyles.base, { backgroundColor: color }]} />
    </View>
  );
}

export default forwardRef<InputBarHandle, InputBarProps>(function InputBar({
  onSubmit,
  isSubmitting,
  onChangeText,
  voiceStatus,
  voicePartialText,
  voiceError: _voiceError,
  isVoiceAvailable,
  onMicPress,
}, ref) {
  const [text, setRawText] = useState('');
  const isDarkMode = useColorScheme() === 'dark';
  const ignoreVoicePartialRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      setText: (newText: string) => {
        ignoreVoicePartialRef.current = true;
        setRawText(newText);
      },
    }),
    [],
  );

  useEffect(() => {
    if (voiceStatus === 'listening') {
      ignoreVoicePartialRef.current = false;
    }
  }, [voiceStatus]);

  useEffect(() => {
    if (ignoreVoicePartialRef.current) return;
    if (voicePartialText !== undefined && voicePartialText !== '' && voiceStatus === 'listening') {
      setRawText(voicePartialText);
    }
  }, [voicePartialText, voiceStatus]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSubmitting) return;

    try {
      await onSubmit(trimmed);
      setRawText('');
      ignoreVoicePartialRef.current = false;
    } catch {
      // keep text on failure
    }
  }, [text, isSubmitting, onSubmit]);

  const handleChangeText = useCallback(
    (newText: string) => {
      setRawText(newText);
      onChangeText?.(newText);
    },
    [onChangeText],
  );

  const handleSubmitEditing = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const handleMicPress = useCallback(() => {
    if (isVoiceAvailable === false) return;
    onMicPress?.();
  }, [isVoiceAvailable, onMicPress]);

  const trimmedEmpty = text.trim().length === 0;
  const showMic = onMicPress !== undefined;
  const isListening = voiceStatus === 'listening' || voiceStatus === 'processing';
  const micDisabled = isVoiceAvailable === false;
  const iconColor = isDarkMode ? '#FFFFFF' : '#000000';

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {showMic && (
        <Pressable
          onPress={handleMicPress}
          disabled={micDisabled}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[
            styles.micButton,
            isDarkMode && styles.micButtonDark,
            micDisabled && styles.micButtonDisabled,
          ]}
        >
          {isListening ? (
            <WaveformIndicator isActive />
          ) : (
            <MicIcon color={iconColor} />
          )}
        </Pressable>
      )}
      <TextInput
        style={[styles.input, isDarkMode && styles.inputDark]}
        placeholder="What did you eat or do?"
        placeholderTextColor={isDarkMode ? '#888888' : '#999999'}
        value={text}
        onChangeText={handleChangeText}
        editable={!isSubmitting}
        returnKeyType="send"
        onSubmitEditing={handleSubmitEditing}
        blurOnSubmit={false}
      />
      {isSubmitting ? (
        <ActivityIndicator
          size="small"
          style={styles.spinner}
          color={isDarkMode ? '#FFFFFF' : '#000000'}
        />
      ) : (
        <Pressable
          onPress={handleSubmit}
          disabled={trimmedEmpty}
          style={[
            styles.button,
            trimmedEmpty && styles.buttonDisabled,
            isDarkMode && styles.buttonDark,
          ]}
        >
          <Text
            style={[
              styles.buttonText,
              trimmedEmpty && styles.buttonTextDisabled,
              isDarkMode && styles.buttonTextDark,
            ]}
          >
            Send
          </Text>
        </Pressable>
      )}
    </View>
  );
});

const micStyles = StyleSheet.create({
  container: {
    width: 14,
    height: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  head: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 1,
  },
  body: {
    width: 4,
    height: 5,
  },
  base: {
    width: 14,
    height: 3,
    borderRadius: 1.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    borderTopColor: '#333333',
    backgroundColor: '#1C1C1E',
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    color: '#000000',
  },
  inputDark: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micButtonDark: {
    backgroundColor: '#3A3A3C',
  },
  micButtonDisabled: {
    opacity: 0.4,
  },
  spinner: {
    marginLeft: 12,
    width: 32,
    height: 32,
  },
  button: {
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#007AFF',
  },
  buttonDark: {
    backgroundColor: '#0A84FF',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextDark: {
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
  },
});
