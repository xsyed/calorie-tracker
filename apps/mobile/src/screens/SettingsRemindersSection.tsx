import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import type {
  MealReminder,
  MealReminderType,
  ReminderWeekday,
} from '../database';
import type { NotificationPermissionStatus } from '../services';

interface MealReminderForm {
  reminder_type: MealReminderType;
  local_time: string;
  enabled: boolean;
  enabled_days: ReminderWeekday[];
}

export interface MealReminderSettingsForm {
  reminders_enabled: boolean;
  reminders: MealReminderForm[];
}

interface SettingsRemindersSectionProps {
  form: MealReminderSettingsForm | null;
  isDarkMode: boolean;
  permissionStatus: NotificationPermissionStatus | null;
  errors: Partial<Record<MealReminderType, string>>;
  onOpenAlarmPermissionSettings: () => void;
  onOpenChannelSettings: () => void;
  onOpenNotificationSettings: () => void;
  onRequestPermission: () => void;
  onUpdateForm: (form: MealReminderSettingsForm) => void;
}

const WEEKDAYS: ReminderWeekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_LABELS: Record<ReminderWeekday, string> = {
  monday: 'M',
  tuesday: 'T',
  wednesday: 'W',
  thursday: 'T',
  friday: 'F',
  saturday: 'S',
  sunday: 'S',
};

const MEAL_LABELS: Record<MealReminderType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

export function mapRemindersToForm(
  remindersEnabled: boolean,
  reminders: MealReminder[],
): MealReminderSettingsForm {
  return {
    reminders_enabled: remindersEnabled,
    reminders: reminders.map((reminder) => ({
      reminder_type: reminder.reminder_type,
      local_time: reminder.local_time,
      enabled: reminder.enabled,
      enabled_days: [...reminder.enabled_days],
    })),
  };
}

export function isReminderSettingsDirty(
  loaded: MealReminderSettingsForm | null,
  form: MealReminderSettingsForm | null,
): boolean {
  if (loaded === null || form === null) return false;
  if (loaded.reminders_enabled !== form.reminders_enabled) return true;
  if (loaded.reminders.length !== form.reminders.length) return true;

  return loaded.reminders.some((loadedReminder, index) => {
    const formReminder = form.reminders[index];
    if (formReminder === undefined) return true;

    return (
      loadedReminder.reminder_type !== formReminder.reminder_type ||
      loadedReminder.local_time !== formReminder.local_time ||
      loadedReminder.enabled !== formReminder.enabled ||
      loadedReminder.enabled_days.join(',') !== formReminder.enabled_days.join(',')
    );
  });
}

export function validateReminderSettings(
  form: MealReminderSettingsForm | null,
): Partial<Record<MealReminderType, string>> {
  if (form === null) return {};

  return form.reminders.reduce<Partial<Record<MealReminderType, string>>>(
    (errors, reminder) => {
      if (!isValidLocalTime(reminder.local_time)) {
        errors[reminder.reminder_type] = 'Use 24-hour HH:MM time.';
      } else if (reminder.enabled && reminder.enabled_days.length === 0) {
        errors[reminder.reminder_type] = 'Select at least one day.';
      }
      return errors;
    },
    {},
  );
}

export default function SettingsRemindersSection({
  form,
  isDarkMode,
  permissionStatus,
  errors,
  onOpenAlarmPermissionSettings,
  onOpenChannelSettings,
  onOpenNotificationSettings,
  onRequestPermission,
  onUpdateForm,
}: SettingsRemindersSectionProps) {
  return (
    <>
      {form === null || permissionStatus === null ? (
        <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
          Reminder settings are loading.
        </Text>
      ) : permissionStatus.state === 'channel-blocked' ? (
        <BlockedState
          body="Meal reminders are off for this Android notification channel."
          buttonLabel="Open Channel Settings"
          isDarkMode={isDarkMode}
          onPress={onOpenChannelSettings}
        />
      ) : permissionStatus.state === 'alarm-disabled' ? (
        <BlockedState
          body="Exact alarm access is disabled. Meal reminders cannot fire reliably until alarms are allowed."
          buttonLabel="Open Alarm Settings"
          isDarkMode={isDarkMode}
          onPress={onOpenAlarmPermissionSettings}
        />
      ) : permissionStatus.canScheduleMealReminders ? (
        <ReminderForm
          errors={errors}
          form={form}
          isDarkMode={isDarkMode}
          onUpdateForm={onUpdateForm}
        />
      ) : permissionStatus.state === 'not-determined' ? (
        <BlockedState
          body="Enable notifications before configuring meal reminders."
          buttonLabel="Enable Notifications"
          isDarkMode={isDarkMode}
          onPress={onRequestPermission}
        />
      ) : (
        <BlockedState
          body="Notifications are disabled. Meal reminders cannot fire until notifications are allowed."
          buttonLabel="Open Settings"
          isDarkMode={isDarkMode}
          onPress={onOpenNotificationSettings}
        />
      )}
    </>
  );
}

interface ReminderFormProps {
  form: MealReminderSettingsForm;
  isDarkMode: boolean;
  errors: Partial<Record<MealReminderType, string>>;
  onUpdateForm: (form: MealReminderSettingsForm) => void;
}

function ReminderForm({
  form,
  isDarkMode,
  errors,
  onUpdateForm,
}: ReminderFormProps) {
  const updateReminder = (
    reminderType: MealReminderType,
    updates: Partial<MealReminderForm>,
  ) => {
    onUpdateForm({
      ...form,
      reminders: form.reminders.map((reminder) =>
        reminder.reminder_type === reminderType
          ? { ...reminder, ...updates }
          : reminder,
      ),
    });
  };

  return (
    <>
      <View style={styles.toggleRow}>
        <View style={styles.toggleTextGroup}>
          <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
            Meal reminders
          </Text>
          <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
            Changes apply after Save.
          </Text>
          <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
            Reminders use device local time. After travel, adjust times manually if needed.
          </Text>
        </View>
        <Switch
          value={form.reminders_enabled}
          accessibilityLabel="Meal reminders"
          accessibilityHint="Enable meal reminder notifications."
          onValueChange={(reminders_enabled) =>
            onUpdateForm({ ...form, reminders_enabled })
          }
        />
      </View>

      {form.reminders.map((reminder) => (
        <View
          key={reminder.reminder_type}
          style={[styles.slot, isDarkMode && styles.slotDark]}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextGroup}>
              <Text style={[styles.rowLabel, isDarkMode && styles.rowLabelDark]}>
                {MEAL_LABELS[reminder.reminder_type]}
              </Text>
              <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
                {reminder.local_time}
              </Text>
            </View>
            <Switch
              value={reminder.enabled}
              accessibilityLabel={`${MEAL_LABELS[reminder.reminder_type]} reminder`}
              onValueChange={(enabled) =>
                updateReminder(reminder.reminder_type, { enabled })
              }
            />
          </View>
          <Text style={[styles.fieldLabel, isDarkMode && styles.fieldLabelDark]}>
            Time
          </Text>
          <TextInput
            style={[
              styles.input,
              isDarkMode ? styles.inputDark : styles.inputLight,
              errors[reminder.reminder_type] !== undefined && styles.inputError,
            ]}
            value={reminder.local_time}
            onChangeText={(local_time) =>
              updateReminder(reminder.reminder_type, { local_time })
            }
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            placeholder="HH:MM"
            placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
            accessibilityLabel={`${MEAL_LABELS[reminder.reminder_type]} time`}
          />
          <View style={styles.dayActions}>
            <Pressable
              style={[styles.smallButton, isDarkMode && styles.smallButtonDark]}
              accessibilityRole="button"
              onPress={() =>
                updateReminder(reminder.reminder_type, { enabled_days: [...WEEKDAYS] })
              }
            >
              <Text style={[styles.smallButtonText, isDarkMode && styles.smallButtonTextDark]}>
                Every day
              </Text>
            </Pressable>
            <Pressable
              style={[styles.smallButton, isDarkMode && styles.smallButtonDark]}
              accessibilityRole="button"
              onPress={() =>
                updateReminder(reminder.reminder_type, {
                  enabled_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
                })
              }
            >
              <Text style={[styles.smallButtonText, isDarkMode && styles.smallButtonTextDark]}>
                Weekdays
              </Text>
            </Pressable>
          </View>
          <View style={styles.dayGroup}>
            {WEEKDAYS.map((day) => {
              const selected = reminder.enabled_days.includes(day);
              return (
                <Pressable
                  key={day}
                  style={[
                    styles.day,
                    isDarkMode && styles.dayDark,
                    selected && styles.daySelected,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() =>
                    updateReminder(reminder.reminder_type, {
                      enabled_days: toggleDay(reminder.enabled_days, day),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.dayText,
                      isDarkMode && styles.dayTextDark,
                      selected && styles.dayTextSelected,
                    ]}
                  >
                    {WEEKDAY_LABELS[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors[reminder.reminder_type] !== undefined && (
            <Text style={styles.errorText}>{errors[reminder.reminder_type]}</Text>
          )}
        </View>
      ))}
    </>
  );
}

interface BlockedStateProps {
  body: string;
  buttonLabel: string;
  isDarkMode: boolean;
  onPress: () => void;
}

function BlockedState({
  body,
  buttonLabel,
  isDarkMode,
  onPress,
}: BlockedStateProps) {
  return (
    <>
      <Text style={[styles.helperText, isDarkMode && styles.helperTextDark]}>
        {body}
      </Text>
      <Pressable style={styles.primaryButton} onPress={onPress}>
        <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
      </Pressable>
    </>
  );
}

function toggleDay(days: ReminderWeekday[], day: ReminderWeekday): ReminderWeekday[] {
  if (days.includes(day)) return days.filter((currentDay) => currentDay !== day);

  return WEEKDAYS.filter((currentDay) => currentDay === day || days.includes(currentDay));
}

function isValidLocalTime(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}

const styles = StyleSheet.create({
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextGroup: {
    flex: 1,
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
  slot: {
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 12,
  },
  slotDark: {
    borderTopColor: '#2C2C2E',
  },
  fieldLabel: {
    marginBottom: -4,
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  fieldLabelDark: {
    color: '#D1D1D6',
  },
  input: {
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
  dayActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallButton: {
    minHeight: 34,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
  },
  smallButtonDark: {
    borderColor: '#3A3A3C',
    backgroundColor: '#2C2C2E',
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  smallButtonTextDark: {
    color: '#D1D1D6',
  },
  dayGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  day: {
    minWidth: 38,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    backgroundColor: '#FFFFFF',
  },
  dayDark: {
    borderColor: '#3A3A3C',
    backgroundColor: '#2C2C2E',
  },
  daySelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3A3A3C',
  },
  dayTextDark: {
    color: '#D1D1D6',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#FF3B30',
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
});
