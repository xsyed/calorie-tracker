import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

export interface InputBarHandle {
  focus: () => void;
  setText: (text: string) => void;
}

interface InputBarProps {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
  onBlur?: () => void;
  onChangeText?: (text: string) => void;
  onBookmarkPress?: () => void;
}

export default forwardRef<InputBarHandle, InputBarProps>(function InputBar({
  onSubmit,
  isSubmitting,
  onBlur,
  onChangeText,
  onBookmarkPress,
}, ref) {
  const [text, setRawText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const isDarkMode = useColorScheme() === 'dark';

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      setText: (newText: string) => {
        setRawText(newText);
      },
    }),
    [],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSubmitting) return;

    try {
      await onSubmit(trimmed);
      setRawText('');
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

  const trimmedEmpty = text.trim().length === 0;

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {onBookmarkPress !== undefined && (
        <Pressable
          onPress={onBookmarkPress}
          disabled={isSubmitting}
          hitSlop={8}
          style={[
            styles.bookmarkButton,
            isDarkMode && styles.bookmarkButtonDark,
            isSubmitting && styles.buttonDisabled,
          ]}
        >
          <BookmarkIcon
            backgroundColor={isDarkMode ? '#2C2C2E' : '#F0F0F0'}
            color={isDarkMode ? '#FFFFFF' : '#000000'}
          />
        </Pressable>
      )}
      <TextInput
        ref={inputRef}
        style={[styles.input, isDarkMode && styles.inputDark]}
        placeholder="What did you eat or exercise?"
        placeholderTextColor={isDarkMode ? '#888888' : '#999999'}
        value={text}
        onChangeText={handleChangeText}
        editable={!isSubmitting}
        returnKeyType="send"
        onBlur={onBlur}
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

interface BookmarkIconProps {
  backgroundColor: string;
  color: string;
}

function BookmarkIcon({ backgroundColor, color }: BookmarkIconProps) {
  return (
    <View style={[styles.bookmarkIcon, { backgroundColor: color }]}>
      <View style={[styles.bookmarkNotch, { backgroundColor }]} />
    </View>
  );
}

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
  bookmarkButton: {
    width: 40,
    height: 40,
    marginRight: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  bookmarkButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  bookmarkIcon: {
    width: 15,
    height: 21,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
  },
  bookmarkNotch: {
    position: 'absolute',
    bottom: -5,
    width: 10,
    height: 10,
    alignSelf: 'center',
    transform: [{ rotate: '45deg' }],
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
