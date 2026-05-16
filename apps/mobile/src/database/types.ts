export interface User {
  id: string;
  firebase_uid: string;
  gender: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  age: number;
  goal: 'lose' | 'maintain' | 'gain';
  target_weight_kg: number | null;
  timeframe_days: number | null;
  daily_target_calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  activity_multiplier: number;
}

export interface OnboardingFormData {
  gender: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  age: number;
  goal: 'lose' | 'maintain' | 'gain';
  target_weight_kg?: number;
  timeframe_days?: number;
}

export interface FoodEntry {
  id: string;
  user_id: string;
  date: string;
  raw_text: string;
  status: 'pending' | 'complete' | 'failed';
  retry_count: number;
  created_at: string;
}

export interface FoodItem {
  id: string;
  food_entry_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FoodEntryWithItems {
  entry: FoodEntry;
  items: FoodItem[];
}

export interface ExerciseEntry {
  id: string;
  user_id: string;
  food_entry_id: string | null;
  date: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  timestamp: string;
}

export interface DeletedFoodEntrySnapshot {
  entry: FoodEntry;
  items: FoodItem[];
  exerciseEntries: ExerciseEntry[];
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface BackupMetadata {
  last_backup_at: string | null;
  last_backup_size_bytes: number | null;
  last_backup_checksum: string | null;
  backup_count: number;
}

export interface BackupPreferences {
  weekly_backup_enabled: boolean;
  wifi_only: boolean;
  max_backup_count: number;
}

export type MealReminderType = 'breakfast' | 'lunch' | 'dinner';

export type ReminderWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface MealReminder {
  id: string | null;
  user_id: string;
  reminder_type: MealReminderType;
  local_time: string;
  enabled: boolean;
  enabled_days: ReminderWeekday[];
}

export interface MealReminderPreferences {
  user_id: string;
  reminders_enabled: boolean;
}

export interface WaterEntry {
  id: string;
  user_id: string;
  date: string;
  amount_ml: number;
  timestamp: string;
}

export interface WaterDailyTotal {
  date: string;
  total_ml: number;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  timestamp: string;
}

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface SavedMealItem {
  id: string;
  saved_meal_id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface SavedMealWithItems {
  savedMeal: SavedMeal;
  items: SavedMealItem[];
}
