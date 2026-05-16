import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface EditFoodEntryPromptProps {
  isDark: boolean;
  prompt: string;
  originalPrompt: string;
  error: string | null;
  progressLabel: string | null;
  isSaving: boolean;
  onChangePrompt: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

export default function EditFoodEntryPrompt({
  isDark,
  prompt,
  originalPrompt,
  error,
  progressLabel,
  isSaving,
  onChangePrompt,
  onCancel,
  onSubmit,
}: EditFoodEntryPromptProps) {
  const canSubmit = prompt.trim().length > 0 && !isSaving;

  return (
    <View style={styles.backdrop}>
      <View style={[styles.card, isDark && styles.cardDark]}>
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, isDark && styles.titleDark]}>
            Edit Prompt
          </Text>
          <TextInput
            value={prompt}
            onChangeText={onChangePrompt}
            placeholder="Describe the corrected meal or exercise"
            placeholderTextColor={isDark ? '#8E8E93' : '#999999'}
            editable={!isSaving}
            multiline
            autoFocus
            style={[styles.input, isDark && styles.inputDark]}
          />

          <Text style={[styles.referenceLabel, isDark && styles.referenceLabelDark]}>
            Original prompt
          </Text>
          <Text style={[styles.referenceText, isDark && styles.referenceTextDark]}>
            {originalPrompt}
          </Text>

          {isSaving && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={isDark ? '#FFFFFF' : '#007AFF'} />
              <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
                {progressLabel ?? 'Updating entry...'}
              </Text>
            </View>
          )}

          {error !== null && (
            <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
              {error}
            </Text>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            disabled={isSaving}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            <Text style={styles.submitText}>
              {isSaving ? 'Re-submitting...' : 'Re-submit to LLM'}
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
    maxHeight: '86%',
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
    minHeight: 112,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
    borderRadius: 8,
    fontSize: 16,
    color: '#000000',
    textAlignVertical: 'top',
  },
  inputDark: {
    borderColor: '#48484A',
    color: '#FFFFFF',
  },
  referenceLabel: {
    marginTop: 14,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#666666',
  },
  referenceLabelDark: {
    color: '#BBBBBB',
  },
  referenceText: {
    fontSize: 14,
    color: '#555555',
  },
  referenceTextDark: {
    color: '#D1D1D6',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#555555',
  },
  loadingTextDark: {
    color: '#D1D1D6',
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
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
