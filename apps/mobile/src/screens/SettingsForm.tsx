import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ACTIVITY_MULTIPLIER_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
} from './settingsFormUtils';
import type {
  SelectOption,
  SettingsFormState,
  SettingsValidationErrors,
  SettingsValidationField,
} from './settingsFormUtils';

export type SettingsTextFieldKey = Exclude<
  keyof SettingsFormState,
  'gender' | 'goal' | 'activity_multiplier'
>;

interface SettingsFormProps {
  authIdentity: string;
  backupSection: React.ReactNode;
  remindersSection: React.ReactNode;
  errors: SettingsValidationErrors;
  form: SettingsFormState;
  isDarkMode: boolean;
  onBlurValidationField: (field: SettingsValidationField) => void;
  onRecalculateTargets: () => void;
  onSignOut: () => void;
  onUpdateForm: (nextValues: Partial<SettingsFormState>) => void;
  onUpdateTextField: (key: SettingsTextFieldKey, value: string) => void;
  signOutError: string | null;
  isSigningOut: boolean;
  bottomInset: number;
}

export default function SettingsForm({
  authIdentity,
  backupSection,
  remindersSection,
  errors,
  form,
  isDarkMode,
  onBlurValidationField,
  onRecalculateTargets,
  onSignOut,
  onUpdateForm,
  onUpdateTextField,
  signOutError,
  isSigningOut,
  bottomInset,
}: SettingsFormProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset + 24 }]}
    >
      <SettingsSection
        title="Profile"
        helperText="Profile edits do not change daily or macro targets until Recalculate is used."
        isDarkMode={isDarkMode}
      >
        <SegmentedField
          label="Gender"
          options={GENDER_OPTIONS}
          value={form.gender}
          isDarkMode={isDarkMode}
          onChange={(gender) => onUpdateForm({ gender })}
        />
        <SettingsInput
          label="Height"
          unit="cm"
          value={form.height_cm}
          isDarkMode={isDarkMode}
          onChangeText={(value) => onUpdateTextField('height_cm', value)}
        />
        <SettingsInput
          label="Current weight"
          unit="kg"
          value={form.current_weight_kg}
          isDarkMode={isDarkMode}
          onChangeText={(value) => onUpdateTextField('current_weight_kg', value)}
        />
        <SettingsInput
          label="Age"
          value={form.age}
          isDarkMode={isDarkMode}
          onChangeText={(value) => onUpdateTextField('age', value)}
        />
        <SegmentedField
          label="Goal"
          options={GOAL_OPTIONS}
          value={form.goal}
          isDarkMode={isDarkMode}
          onChange={(goal) => onUpdateForm({ goal })}
        />
        <SettingsInput
          label="Target weight"
          unit="kg"
          value={form.target_weight_kg}
          isDarkMode={isDarkMode}
          onChangeText={(value) => onUpdateTextField('target_weight_kg', value)}
        />
        <SettingsInput
          label="Timeframe"
          unit="days"
          value={form.timeframe_days}
          isDarkMode={isDarkMode}
          onChangeText={(value) => onUpdateTextField('timeframe_days', value)}
        />
      </SettingsSection>

      <SettingsSection title="Daily Target" isDarkMode={isDarkMode}>
        <SettingsInput
          label="Calories"
          unit="kcal/day"
          value={form.daily_target_calories}
          error={errors.daily_target_calories}
          isDarkMode={isDarkMode}
          onBlur={() => onBlurValidationField('daily_target_calories')}
          onChangeText={(value) => onUpdateTextField('daily_target_calories', value)}
        />
        <SegmentedField
          label="Activity"
          options={ACTIVITY_MULTIPLIER_OPTIONS}
          value={form.activity_multiplier}
          isDarkMode={isDarkMode}
          onChange={(activity_multiplier) => onUpdateForm({ activity_multiplier })}
        />
      </SettingsSection>

      <SettingsSection title="Macro Targets" isDarkMode={isDarkMode}>
        <SettingsInput
          label="Protein"
          unit="g"
          value={form.protein_g}
          error={errors.protein_g}
          isDarkMode={isDarkMode}
          onBlur={() => onBlurValidationField('protein_g')}
          onChangeText={(value) => onUpdateTextField('protein_g', value)}
        />
        <SettingsInput
          label="Carbs"
          unit="g"
          value={form.carbs_g}
          error={errors.carbs_g}
          isDarkMode={isDarkMode}
          onBlur={() => onBlurValidationField('carbs_g')}
          onChangeText={(value) => onUpdateTextField('carbs_g', value)}
        />
        <SettingsInput
          label="Fat"
          unit="g"
          value={form.fat_g}
          error={errors.fat_g}
          isDarkMode={isDarkMode}
          onBlur={() => onBlurValidationField('fat_g')}
          onChangeText={(value) => onUpdateTextField('fat_g', value)}
        />
        <Pressable style={styles.primaryButton} onPress={onRecalculateTargets}>
          <Text style={styles.primaryButtonText}>Recalculate from profile</Text>
        </Pressable>
      </SettingsSection>

      {remindersSection}

      {backupSection}

      <SettingsSection title="Account" isDarkMode={isDarkMode}>
        <ReadOnlyRow label="Signed in as" value={authIdentity} isDarkMode={isDarkMode} />
        <Pressable
          style={[styles.signOutButton, isSigningOut && styles.buttonDisabled]}
          onPress={onSignOut}
          disabled={isSigningOut}
        >
          <Text style={styles.signOutButtonText}>
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Text>
        </Pressable>
        {signOutError !== null && (
          <Text style={styles.errorText}>{signOutError}</Text>
        )}
        <Pressable
          style={[styles.deleteButton, styles.buttonDisabled]}
          disabled
          accessibilityState={{ disabled: true }}
        >
          <Text style={[styles.deleteButtonText, isDarkMode && styles.deleteButtonTextDark]}>
            Delete Account (coming soon)
          </Text>
        </Pressable>
      </SettingsSection>
    </ScrollView>
  );
}

interface SettingsSectionProps {
  title: string;
  isDarkMode: boolean;
  helperText?: string;
  children: React.ReactNode;
}

function SettingsSection({
  title,
  isDarkMode,
  helperText,
  children,
}: SettingsSectionProps) {
  return (
    <View style={[styles.section, isDarkMode && styles.sectionDark]}>
      <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
        {title}
      </Text>
      {helperText !== undefined && (
        <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
          {helperText}
        </Text>
      )}
      {children}
    </View>
  );
}

interface SettingsInputProps {
  label: string;
  value: string;
  isDarkMode: boolean;
  onChangeText: (value: string) => void;
  error?: string | undefined;
  onBlur?: (() => void) | undefined;
  unit?: string;
}

function SettingsInput({
  label,
  value,
  isDarkMode,
  onChangeText,
  error,
  onBlur,
  unit,
}: SettingsInputProps) {
  const hasError = error !== undefined;
  return (
    <View>
      <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>
        {label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            isDarkMode ? styles.inputDark : styles.inputLight,
            hasError && styles.inputError,
          ]}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="numeric"
          returnKeyType="done"
          placeholder="Not set"
          placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
          accessibilityLabel={label}
          accessibilityHint={error}
        />
        {unit !== undefined && (
          <Text style={[styles.unit, isDarkMode && styles.unitDark]}>{unit}</Text>
        )}
      </View>
      {error !== undefined && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

interface SegmentedFieldProps<T extends string | number> {
  label: string;
  options: SelectOption<T>[];
  value: T;
  isDarkMode: boolean;
  onChange: (value: T) => void;
}

function SegmentedField<T extends string | number>({
  label,
  options,
  value,
  isDarkMode,
  onChange,
}: SegmentedFieldProps<T>) {
  return (
    <View>
      <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>
        {label}
      </Text>
      <View style={styles.optionGroup}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              style={[
                styles.option,
                isDarkMode && styles.optionDark,
                selected && styles.optionSelected,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  isDarkMode && styles.optionTextDark,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface ReadOnlyRowProps {
  label: string;
  value: string;
  isDarkMode: boolean;
}

function ReadOnlyRow({ label, value, isDarkMode }: ReadOnlyRowProps) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, isDarkMode && styles.rowValueDark]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  sectionDark: {
    borderColor: '#2C2C2E',
    backgroundColor: '#1C1C1E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#666666',
  },
  helperTextDark: {
    color: '#B0B0B0',
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  fieldLabelDark: {
    color: '#D1D1D6',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  inputLight: {
    borderColor: '#D1D1D6',
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#3A3A3C',
    color: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#FF3B30',
  },
  unit: {
    minWidth: 68,
    fontSize: 14,
    color: '#666666',
  },
  unitDark: {
    color: '#B0B0B0',
  },
  optionGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  optionDark: {
    borderColor: '#3A3A3C',
    backgroundColor: '#2C2C2E',
  },
  optionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  optionTextDark: {
    color: '#D1D1D6',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signOutButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  deleteButtonTextDark: {
    color: '#8E8E93',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  readOnlyRow: {
    gap: 4,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  rowLabelDark: {
    color: '#B0B0B0',
  },
  rowValue: {
    fontSize: 15,
    color: '#000000',
  },
  rowValueDark: {
    color: '#FFFFFF',
  },
});
