import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 500;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface WeightLogFormProps {
  isDarkMode: boolean;
  onCancel: () => void;
  onSave: (date: string, weightKg: number) => Promise<void>;
  visible: boolean;
}

interface FormErrors {
  date: string | null;
  save: string | null;
  weight: string | null;
}

export function WeightLogForm({
  isDarkMode,
  onCancel,
  onSave,
  visible,
}: WeightLogFormProps) {
  const [date, setDate] = useState(getTodayDate());
  const [weight, setWeight] = useState('');
  const [errors, setErrors] = useState<FormErrors>({
    date: null,
    save: null,
    weight: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setDate(getTodayDate());
      setWeight('');
      setErrors({ date: null, save: null, weight: null });
      setSaving(false);
    }
  }, [visible]);

  const handleSave = async () => {
    const nextDateError = getDateError(date);
    const nextWeightError = getWeightError(weight);
    if (nextDateError !== null || nextWeightError !== null) {
      setErrors({
        date: nextDateError,
        save: null,
        weight: nextWeightError,
      });
      return;
    }

    setSaving(true);
    setErrors({ date: null, save: null, weight: null });
    try {
      await onSave(date, Number(weight.trim()));
    } catch {
      setErrors({
        date: null,
        save: 'Failed to save weigh-in.',
        weight: null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setErrors((current) => ({ ...current, date: null, save: null }));
  };

  const handleWeightChange = (value: string) => {
    setWeight(value);
    setErrors((current) => ({ ...current, save: null, weight: null }));
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.card, isDarkMode && styles.cardDark]}>
          <Text style={[styles.title, isDarkMode && styles.titleDark]}>
            Log Weight
          </Text>
          <Text style={[styles.label, isDarkMode && styles.labelDark]}>
            Date
          </Text>
          <TextInput
            value={date}
            onChangeText={handleDateChange}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={isDarkMode ? '#777777' : '#888888'}
            style={[styles.input, isDarkMode && styles.inputDark]}
          />
          {errors.date !== null && <Text style={styles.inlineError}>{errors.date}</Text>}

          <Text style={[styles.label, isDarkMode && styles.labelDark]}>
            Weight (kg)
          </Text>
          <TextInput
            value={weight}
            onChangeText={handleWeightChange}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="Weight in kg"
            placeholderTextColor={isDarkMode ? '#777777' : '#888888'}
            style={[styles.input, isDarkMode && styles.inputDark]}
          />
          {errors.weight !== null && <Text style={styles.inlineError}>{errors.weight}</Text>}
          {errors.save !== null && <Text style={styles.inlineError}>{errors.save}</Text>}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={saving}
              style={[styles.cancelButton, isDarkMode && styles.cancelButtonDark, saving && styles.disabled]}
            >
              <Text style={[styles.cancelText, isDarkMode && styles.cancelTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, saving && styles.disabled]}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function getDateError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Date is required.';
  if (!isValidDateInput(trimmed)) return 'Enter a valid date.';
  if (trimmed > getTodayDate()) return 'Date cannot be in the future.';
  return null;
}

function getWeightError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Weight is required.';

  const weightKg = Number(trimmed);
  if (!Number.isFinite(weightKg)) return 'Enter a numeric weight.';
  if (weightKg <= 0) return 'Weight must be greater than 0 kg.';
  if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) {
    return 'Weight must be between 20 and 500 kg.';
  }
  return null;
}

function isValidDateInput(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && getDateInputValue(parsed) === value;
}

function getTodayDate(): string {
  return getDateInputValue(new Date());
}

function getDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  card: {
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1C1C1E',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111111',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  label: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },
  labelDark: {
    color: '#BBBBBB',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CCCCCC',
    color: '#111111',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#444444',
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  inlineError: {
    marginTop: 8,
    fontSize: 13,
    color: '#D70015',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  cancelButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  cancelTextDark: {
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
});
