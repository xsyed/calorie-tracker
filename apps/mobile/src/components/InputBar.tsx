import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

interface InputBarProps {
  onSubmit: (text: string) => Promise<void>;
  isSubmitting: boolean;
  onChangeText?: (text: string) => void;
}

export default function InputBar({
  onSubmit,
  isSubmitting,
  onChangeText,
}: InputBarProps) {
  const [text, setText] = useState('');
  const isDarkMode = useColorScheme() === 'dark';

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (trimmed.length === 0 || isSubmitting) return;

    try {
      await onSubmit(trimmed);
      setText('');
    } catch {
      // keep text on failure
    }
  }, [text, isSubmitting, onSubmit]);

  const handleChangeText = useCallback(
    (newText: string) => {
      setText(newText);
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
