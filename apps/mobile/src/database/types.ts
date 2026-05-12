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
