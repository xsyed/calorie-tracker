export { initDatabase } from './database';
export { userExists, insertUser, getUser } from './userRepository';
export {
  insertFoodEntry,
  insertFoodItem,
  getFoodEntriesByDate,
  getFoodItemsByEntryId,
  getPendingEntries,
  updateFoodEntryStatus,
  incrementRetryCount,
  saveParsedLogEntry,
  completePendingEntry,
  getDailyCalorieTotals,
  getLoggedDatesInRange,
} from './foodRepository';
export {
  insertExerciseEntry,
  getExerciseEntriesByDate,
  getDailyExerciseCalories,
} from './exerciseRepository';
export {
  getCompletedHistoryEntries,
  getSavedMeals,
  saveFoodEntryAsSavedMeal,
  deleteSavedMeal,
  createFoodEntryFromHistoryEntry,
  createFoodEntryFromSavedMeal,
} from './historySavedMealsRepository';
export { getSetting, setSetting } from './appSettingsRepository';
export { insertWaterEntry, getWaterEntriesByDate, getDailyWaterTotal } from './waterRepository';
export type {
  User,
  OnboardingFormData,
  FoodEntry,
  FoodEntryWithItems,
  FoodItem,
  ExerciseEntry,
  AppSetting,
  WaterEntry,
  SavedMeal,
  SavedMealItem,
  SavedMealWithItems,
} from './types';
