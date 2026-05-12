export type SafetyGateResult =
  | { passed: true }
  | { passed: false; currentWeeklyRate: number; safeDays: number };

export interface OnboardingResults {
  gender: 'male' | 'female';
  height_cm: number;
  current_weight_kg: number;
  age: number;
  goal: 'lose' | 'maintain' | 'gain';
  target_weight_kg: number;
  timeframe_days: number | null;
  bmr: number;
  tdee: number;
  daily_target_calories: number;
  calorie_floor_warned: boolean;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  safety_gate: SafetyGateResult;
}
