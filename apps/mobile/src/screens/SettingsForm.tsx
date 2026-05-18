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
export type SettingsSectionId =
  | 'account'
  | 'bodyProfile'
  | 'goalsMacros'
  | 'macroTargets'
  | 'reminders'
  | 'backup';

interface SettingsFormProps {
  authIdentity: string;
  backupSection: React.ReactNode;
  remindersSection: React.ReactNode;
  errors: SettingsValidationErrors;
  expandedSections: Record<SettingsSectionId, boolean>;
  form: SettingsFormState;
  isDarkMode: boolean;
  onBlurValidationField: (field: SettingsValidationField) => void;
  onRecalculateTargets: () => void;
  onSignOut: () => void;
  onToggleSection: (sectionId: SettingsSectionId) => void;
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
  expandedSections,
  form,
  isDarkMode,
  onBlurValidationField,
  onRecalculateTargets,
  onSignOut,
  onToggleSection,
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
        id="account"
        title="Account"
        expanded={expandedSections.account}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
      >
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
      </SettingsSection>

      <SettingsSection
        id="bodyProfile"
        title="Body Profile"
        helperText="Profile edits do not change goals or macro targets until Recalculate is used."
        expanded={expandedSections.bodyProfile}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
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
      </SettingsSection>

      <SettingsSection
        id="goalsMacros"
        title="Goals & Macros"
        expanded={expandedSections.goalsMacros}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
      >
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

      <SettingsSection
        id="macroTargets"
        title="Macro Targets"
        expanded={expandedSections.macroTargets}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
      >
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

      <SettingsSection
        id="reminders"
        title="Reminders"
        expanded={expandedSections.reminders}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
      >
        {remindersSection}
      </SettingsSection>

      <SettingsSection
        id="backup"
        title="Backup"
        expanded={expandedSections.backup}
        isDarkMode={isDarkMode}
        onToggle={onToggleSection}
      >
        {backupSection}
      </SettingsSection>
    </ScrollView>
  );
}

interface SettingsSectionProps {
  id: SettingsSectionId;
  title: string;
  expanded: boolean;
  isDarkMode: boolean;
  onToggle: (sectionId: SettingsSectionId) => void;
  helperText?: string;
  children: React.ReactNode;
}

function SettingsSection({
  id,
  title,
  expanded,
  isDarkMode,
  onToggle,
  helperText,
  children,
}: SettingsSectionProps) {
  return (
    <View style={[styles.section, isDarkMode && styles.sectionDark]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => onToggle(id)}
        style={styles.sectionHeader}
      >
        <Text style={[styles.sectionTitle, isDarkMode && styles.sectionTitleDark]}>
          {title}
        </Text>
        <View
          style={[
            styles.sectionChevron,
            expanded ? styles.sectionChevronUp : styles.sectionChevronDown,
            isDarkMode && (expanded ? styles.sectionChevronUpDark : styles.sectionChevronDownDark),
          ]}
        />
      </Pressable>
      {expanded && (
        <>
          {helperText !== undefined && (
            <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
              {helperText}
            </Text>
          )}
          {children}
        </>
      )}
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
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  sectionChevronDown: {
    borderTopWidth: 8,
    borderTopColor: '#000000',
  },
  sectionChevronDownDark: {
    borderTopColor: '#FFFFFF',
  },
  sectionChevronUp: {
    borderBottomWidth: 8,
    borderBottomColor: '#000000',
  },
  sectionChevronUpDark: {
    borderBottomColor: '#FFFFFF',
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
