import type { OnboardingFormData } from '../database';
import type { OnboardingResults, SafetyGateResult } from './types';

const SEDENTARY_MULTIPLIER = 1.2;
const DEFAULT_DEFICIT = 500;
const DEFAULT_SURPLUS = 500;
const MAX_WEEKLY_RATE_KG = 1.0;
const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const MACRO_RATIOS = {
  lose: { protein: 0.4, carbs: 0.3, fat: 0.3 },
  maintain: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  gain: { protein: 0.25, carbs: 0.45, fat: 0.3 },
} as const;

const CALORIE_FLOOR = { male: 1500, female: 1200 } as const;

export function calculateBMR(
  gender: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

export function calculateTDEE(bmr: number, activityMultiplier: number): number {
  return bmr * activityMultiplier;
}

export function calculateDailyTarget(
  tdee: number,
  goal: 'lose' | 'maintain' | 'gain',
  adjustment = 500,
): number {
  if (goal === 'lose') return tdee - adjustment;
  if (goal === 'gain') return tdee + adjustment;
  return tdee;
}

export function applyCalorieFloor(
  dailyTarget: number,
  gender: 'male' | 'female',
): { target: number; warned: boolean } {
  const floor = CALORIE_FLOOR[gender];
  if (dailyTarget < floor) {
    return { target: floor, warned: true };
  }
  return { target: dailyTarget, warned: false };
}

export function calculateMacroTargets(
  dailyTarget: number,
  goal: 'lose' | 'maintain' | 'gain',
): { proteinG: number; carbsG: number; fatG: number } {
  const ratios = MACRO_RATIOS[goal];
  return {
    proteinG: Math.round((dailyTarget * ratios.protein) / CALORIES_PER_GRAM.protein),
    carbsG: Math.round((dailyTarget * ratios.carbs) / CALORIES_PER_GRAM.carbs),
    fatG: Math.round((dailyTarget * ratios.fat) / CALORIES_PER_GRAM.fat),
  };
}

export function checkSafetyGate(
  goal: 'lose' | 'maintain' | 'gain',
  currentWeight: number,
  targetWeight: number,
  timeframeDays: number | null,
): SafetyGateResult {
  if (goal === 'maintain' || timeframeDays === null || timeframeDays <= 0) {
    return { passed: true };
  }

  const weightChange = Math.abs(currentWeight - targetWeight);
  const weeklyRate = weightChange / (timeframeDays / 7);

  if (weeklyRate > MAX_WEEKLY_RATE_KG) {
    return {
      passed: false,
      currentWeeklyRate: weeklyRate,
      safeDays: Math.ceil((weightChange / MAX_WEEKLY_RATE_KG) * 7),
    };
  }

  return { passed: true };
}

export function calculateOnboardingResults(data: OnboardingFormData): OnboardingResults {
  const targetWeight =
    data.goal === 'maintain' ? data.current_weight_kg : (data.target_weight_kg ?? data.current_weight_kg);

  const timeframeDays =
    data.goal === 'maintain' ? null : (data.timeframe_days ?? null);

  const safetyGate = checkSafetyGate(data.goal, data.current_weight_kg, targetWeight, timeframeDays);

  const bmr = calculateBMR(data.gender, data.current_weight_kg, data.height_cm, data.age);
  const tdee = calculateTDEE(bmr, SEDENTARY_MULTIPLIER);

  const adjustment = data.goal === 'lose' ? DEFAULT_DEFICIT : DEFAULT_SURPLUS;
  const dailyTarget = calculateDailyTarget(tdee, data.goal, adjustment);

  const floorResult = applyCalorieFloor(dailyTarget, data.gender);

  const macros = calculateMacroTargets(floorResult.target, data.goal);

  return {
    gender: data.gender,
    height_cm: data.height_cm,
    current_weight_kg: data.current_weight_kg,
    age: data.age,
    goal: data.goal,
    target_weight_kg: targetWeight,
    timeframe_days: timeframeDays,
    bmr,
    tdee,
    daily_target_calories: floorResult.target,
    calorie_floor_warned: floorResult.warned,
    protein_g: macros.proteinG,
    carbs_g: macros.carbsG,
    fat_g: macros.fatG,
    safety_gate: safetyGate,
  };
}
