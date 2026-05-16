import type { User } from '../database';
import type { UserSettingsUpdate } from '../database';
import {
  applyCalorieFloor,
  calculateBMR,
  calculateDailyTarget,
  calculateMacroTargets,
  calculateTDEE,
} from '../onboarding';

export type ActivityMultiplier = 1.2 | 1.375 | 1.55 | 1.725 | 1.9;
export type SettingsValidationField =
  | 'daily_target_calories'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_g';
export type SettingsValidationErrors = Partial<Record<SettingsValidationField, string>>;

export interface SettingsFormState {
  gender: User['gender'];
  height_cm: string;
  current_weight_kg: string;
  age: string;
  goal: User['goal'];
  target_weight_kg: string;
  timeframe_days: string;
  daily_target_calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  activity_multiplier: ActivityMultiplier;
}

export interface SelectOption<T extends string | number> {
  label: string;
  value: T;
}

const SETTINGS_VALIDATION_FIELDS: SettingsValidationField[] = [
  'daily_target_calories',
  'protein_g',
  'carbs_g',
  'fat_g',
];

const MACRO_FIELD_LABELS: Record<Exclude<SettingsValidationField, 'daily_target_calories'>, string> = {
  protein_g: 'Protein',
  carbs_g: 'Carbs',
  fat_g: 'Fat',
};

export const GENDER_OPTIONS: SelectOption<User['gender']>[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
];

export const GOAL_OPTIONS: SelectOption<User['goal']>[] = [
  { label: 'Lose', value: 'lose' },
  { label: 'Maintain', value: 'maintain' },
  { label: 'Gain', value: 'gain' },
];

export const ACTIVITY_MULTIPLIER_OPTIONS: SelectOption<ActivityMultiplier>[] = [
  { label: 'Sedentary (1.2)', value: 1.2 },
  { label: 'Light (1.375)', value: 1.375 },
  { label: 'Moderate (1.55)', value: 1.55 },
  { label: 'Active (1.725)', value: 1.725 },
  { label: 'Athlete (1.9)', value: 1.9 },
];

export function mapUserToSettingsForm(user: User): SettingsFormState {
  return {
    gender: user.gender,
    height_cm: String(user.height_cm),
    current_weight_kg: String(user.current_weight_kg),
    age: String(user.age),
    goal: user.goal,
    target_weight_kg: formatNullableNumber(user.target_weight_kg),
    timeframe_days: formatNullableNumber(user.timeframe_days),
    daily_target_calories: formatNullableNumber(user.daily_target_calories),
    protein_g: formatNullableNumber(user.protein_g),
    carbs_g: formatNullableNumber(user.carbs_g),
    fat_g: formatNullableNumber(user.fat_g),
    activity_multiplier: normalizeActivityMultiplier(user.activity_multiplier),
  };
}

export function mapSettingsFormToUserUpdate(
  form: SettingsFormState,
): UserSettingsUpdate {
  return {
    gender: form.gender,
    height_cm: Number(form.height_cm),
    current_weight_kg: Number(form.current_weight_kg),
    age: Number(form.age),
    goal: form.goal,
    target_weight_kg: parseNullableNumber(form.target_weight_kg),
    timeframe_days: parseNullableNumber(form.timeframe_days),
    daily_target_calories: parseNullableNumber(form.daily_target_calories),
    protein_g: parseNullableNumber(form.protein_g),
    carbs_g: parseNullableNumber(form.carbs_g),
    fat_g: parseNullableNumber(form.fat_g),
    activity_multiplier: form.activity_multiplier,
  };
}

export function isSettingsDirty(
  loaded: SettingsFormState,
  edited: SettingsFormState,
): boolean {
  return (Object.keys(loaded) as Array<keyof SettingsFormState>).some(
    (key) => loaded[key] !== edited[key],
  );
}

export function recalculateSettingsTargets(
  form: SettingsFormState,
): Pick<
  SettingsFormState,
  'daily_target_calories' | 'protein_g' | 'carbs_g' | 'fat_g'
> {
  const bmr = calculateBMR(
    form.gender,
    parseNumber(form.current_weight_kg),
    parseNumber(form.height_cm),
    parseNumber(form.age),
  );
  const tdee = calculateTDEE(bmr, form.activity_multiplier);
  const rawTarget = calculateDailyTarget(tdee, form.goal);
  const dailyTarget = applyCalorieFloor(rawTarget, form.gender).target;
  const macros = calculateMacroTargets(dailyTarget, form.goal);

  return {
    daily_target_calories: String(dailyTarget),
    protein_g: String(macros.proteinG),
    carbs_g: String(macros.carbsG),
    fat_g: String(macros.fatG),
  };
}

function validateSettingsField(
  field: SettingsValidationField,
  value: string,
): string | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return field === 'daily_target_calories'
      ? 'Enter a daily target.'
      : `Enter ${MACRO_FIELD_LABELS[field]} grams.`;
  }

  if (field === 'daily_target_calories') {
    return parsed < 1200 || parsed > 5000
      ? 'Daily target must be 1200 to 5000 kcal.'
      : undefined;
  }

  return parsed <= 0 || parsed > 500
    ? `${MACRO_FIELD_LABELS[field]} must be greater than 0 and no more than 500g.`
    : undefined;
}

export function validateSettingsForm(form: SettingsFormState): SettingsValidationErrors {
  return SETTINGS_VALIDATION_FIELDS.reduce<SettingsValidationErrors>((errors, field) => {
    const error = validateSettingsField(field, form[field]);
    if (error !== undefined) {
      errors[field] = error;
    }
    return errors;
  }, {});
}

export function getAllSettingsValidationFields(): SettingsValidationField[] {
  return SETTINGS_VALIDATION_FIELDS;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function normalizeActivityMultiplier(value: number): ActivityMultiplier {
  const match = ACTIVITY_MULTIPLIER_OPTIONS.find((option) => option.value === value);
  return match?.value ?? 1.2;
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
