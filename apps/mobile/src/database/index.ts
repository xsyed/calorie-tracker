export { initDatabase } from './database';
export { userExists, insertUser, getUser, updateUserSettings } from './userRepository';
export type { UserSettingsUpdate } from './userRepository';
export {
  DEFAULT_MAX_BACKUP_COUNT,
  getBackupMetadata,
  getBackupPreferences,
  saveBackupMetadata,
  setBackupPreferences,
} from './backupRepository';
export type { BackupMetadataUpdate } from './backupRepository';
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
export {
  DEFAULT_DAILY_WATER_GOAL_ML,
  deleteWaterEntry,
  getDailyWaterGoal,
  getDailyWaterTotal,
  getWaterEntriesByDate,
  getWaterEntriesByDateRange,
  getWaterTotalsByDateRange,
  insertWaterEntry,
  setDailyWaterGoal,
} from './waterRepository';
export {
  deleteWeightEntry,
  getWeightEntries,
  insertWeightEntry,
} from './weightRepository';
export type {
  User,
  OnboardingFormData,
  FoodEntry,
  FoodEntryWithItems,
  FoodItem,
  ExerciseEntry,
  AppSetting,
  BackupMetadata,
  BackupPreferences,
  WaterEntry,
  WaterDailyTotal,
  WeightEntry,
  SavedMeal,
  SavedMealItem,
  SavedMealWithItems,
} from './types';
