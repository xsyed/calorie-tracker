import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SaveMealPrompt({
  isDark,
  name,
  error,
  isSaving,
  onChangeName,
  onCancel,
  onSave,
}: {
  isDark: boolean;
  name: string;
  error: string | null;
  isSaving: boolean;
  onChangeName: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const canSave = name.trim().length > 0 && !isSaving;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Save as Meal
        </Text>
        <TextInput
          value={name}
          onChangeText={onChangeName}
          placeholder="Meal name"
          placeholderTextColor={isDark ? '#8E8E93' : '#999999'}
          editable={!isSaving}
          autoFocus
          style={[styles.input, isDark && styles.inputDark]}
        />
        {error !== null && (
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            {error}
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isSaving}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !canSave && styles.buttonDisabled]}
            onPress={onSave}
            disabled={!canSave}
          >
            <Text style={styles.saveText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#2C2C2E',
  },
  title: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    fontSize: 16,
    color: '#000000',
  },
  inputDark: {
    borderColor: '#48484A',
    color: '#FFFFFF',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#CC0000',
  },
  errorTextDark: {
    color: '#FF4444',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  button: {
    minWidth: 82,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  cancelButton: {
    backgroundColor: '#E5E5EA',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
