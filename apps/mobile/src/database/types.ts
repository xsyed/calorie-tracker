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
  date: string;
  exercise_type: string;
  duration_minutes: number;
  calories_burned: number;
  timestamp: string;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface WaterEntry {
  id: string;
  user_id: string;
  date: string;
  amount_ml: number;
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
