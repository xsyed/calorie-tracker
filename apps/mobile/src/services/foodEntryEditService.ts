import {
  getFoodEntryForUser,
  replaceFoodEntryParsedData,
} from '../database';
import type { ExerciseEntry, FoodEntry, FoodItem } from '../database';
import { checkConnectivity } from './connectivity';
import { parseFoodText } from './llmService';
import type { ParseErrorCode } from './llmService';
import { isQueueFlushing } from './queueFlusher';

export type EditFoodEntryErrorCode =
  | ParseErrorCode
  | 'blank_prompt'
  | 'entry_not_found'
  | 'entry_not_complete'
  | 'flush_in_progress'
  | 'edit_failed';

export type EditFoodEntryProgressStep =
  | 'checking_connectivity'
  | 'parsing'
  | 'replacing';

export interface EditFoodEntryProgress {
  step: EditFoodEntryProgressStep;
}

export interface EditFoodEntrySuccess {
  status: 'success';
  foodEntry: FoodEntry;
  foodItems: FoodItem[];
  exerciseEntries: ExerciseEntry[];
}

export interface EditFoodEntryFailure {
  status: 'error';
  code: EditFoodEntryErrorCode;
  message: string;
  retryAfterMs?: number;
}

export type EditFoodEntryResult = EditFoodEntrySuccess | EditFoodEntryFailure;

export interface EditFoodEntryOptions {
  onProgress?: (progress: EditFoodEntryProgress) => void;
}

function buildFailure(
  code: EditFoodEntryErrorCode,
  message: string,
  retryAfterMs?: number,
): EditFoodEntryFailure {
  const failure: EditFoodEntryFailure = { status: 'error', code, message };
  if (retryAfterMs !== undefined) {
    failure.retryAfterMs = retryAfterMs;
  }
  return failure;
}

export async function editFoodEntryWithPrompt(params: {
  userId: string;
  foodEntryId: string;
  rawPrompt: string;
  options?: EditFoodEntryOptions;
}): Promise<EditFoodEntryResult> {
  if (params.rawPrompt.trim().length === 0) {
    return buildFailure('blank_prompt', 'Prompt cannot be blank.');
  }

  if (isQueueFlushing()) {
    return buildFailure('flush_in_progress', 'Entry is processing. Try again shortly.');
  }

  const entry = await getFoodEntryForUser(params.userId, params.foodEntryId);
  if (!entry) {
    return buildFailure('entry_not_found', 'Food entry not found.');
  }
  if (entry.status !== 'complete') {
    return buildFailure('entry_not_complete', 'Only complete entries can be edited.');
  }

  params.options?.onProgress?.({ step: 'checking_connectivity' });
  const isConnected = await checkConnectivity();
  if (!isConnected) {
    return buildFailure('no_network', 'No network connection');
  }

  params.options?.onProgress?.({ step: 'parsing' });
  const parseResult = await parseFoodText(params.rawPrompt, {
    skipConnectivityCheck: true,
  });
  if (parseResult.outcome === 'error') {
    return buildFailure(
      parseResult.error,
      parseResult.message,
      parseResult.retryAfterMs,
    );
  }

  params.options?.onProgress?.({ step: 'replacing' });
  try {
    const replacement = await replaceFoodEntryParsedData({
      userId: params.userId,
      foodEntryId: params.foodEntryId,
      rawText: params.rawPrompt,
      foods: parseResult.foods,
      exercises: parseResult.exercises.map((exercise) => ({
        exercise_type: exercise.type,
        duration_minutes: exercise.duration_minutes,
        calories_burned: exercise.calories_burned,
      })),
    });

    return {
      status: 'success',
      ...replacement,
    };
  } catch {
    return buildFailure('edit_failed', 'Food entry edit failed.');
  }
}
