import { useCallback, useMemo, useReducer } from 'react';

import type { OnboardingFormData } from '../database';
import { calculateOnboardingResults, checkSafetyGate } from './calculations';
import type { OnboardingResults, SafetyGateResult } from './types';

export type StepName =
  | 'gender'
  | 'age'
  | 'height_cm'
  | 'current_weight_kg'
  | 'goal'
  | 'target_weight_kg'
  | 'timeframe'
  | 'safety_gate'
  | 'summary';

export type PartialOnboardingFormData = Partial<OnboardingFormData>;

const ALL_STEPS: StepName[] = [
  'gender',
  'age',
  'height_cm',
  'current_weight_kg',
  'goal',
  'target_weight_kg',
  'timeframe',
  'safety_gate',
  'summary',
];

const STEP_FIELD: Partial<Record<StepName, keyof OnboardingFormData>> = {
  gender: 'gender',
  age: 'age',
  height_cm: 'height_cm',
  current_weight_kg: 'current_weight_kg',
  goal: 'goal',
  target_weight_kg: 'target_weight_kg',
  timeframe: 'timeframe_days',
};

interface FormState {
  step: StepName;
  formData: PartialOnboardingFormData;
  errors: Partial<Record<keyof OnboardingFormData, string>>;
  safetyGateResult: SafetyGateResult | null;
  calculationResults: OnboardingResults | null;
  safetyGateShown: boolean;
}

type FormAction =
  | { type: 'SET_FIELD'; field: keyof OnboardingFormData; value: unknown }
  | { type: 'GO_NEXT' }
  | { type: 'GO_BACK' }
  | { type: 'ACCEPT_SAFE_TIMEFRAME' }
  | { type: 'REVISE_GOAL' }
  | { type: 'RESET' };

const initialState: FormState = {
  step: 'gender',
  formData: {},
  errors: {},
  safetyGateResult: null,
  calculationResults: null,
  safetyGateShown: false,
};

function validateField(
  field: keyof OnboardingFormData,
  value: unknown,
  formData: PartialOnboardingFormData,
): string | null {
  switch (field) {
    case 'gender':
      if (value !== 'male' && value !== 'female') return 'Gender is required';
      return null;
    case 'age': {
      const age = Number(value);
      if (isNaN(age) || !Number.isInteger(age) || age < 10 || age > 120) {
        return 'Age must be an integer between 10 and 120';
      }
      return null;
    }
    case 'height_cm': {
      const h = Number(value);
      if (isNaN(h) || h < 100 || h > 250) {
        return 'Height must be between 100 and 250 cm';
      }
      return null;
    }
    case 'current_weight_kg': {
      const w = Number(value);
      if (isNaN(w) || w < 30 || w > 300) {
        return 'Weight must be between 30 and 300 kg';
      }
      return null;
    }
    case 'goal':
      if (value !== 'lose' && value !== 'maintain' && value !== 'gain') {
        return 'Goal is required';
      }
      return null;
    case 'target_weight_kg': {
      if (formData.goal === 'maintain') return null;
      const tw = Number(value);
      if (isNaN(tw)) return 'Target weight is required';
      const current = formData.current_weight_kg ?? 0;
      if (formData.goal === 'lose' && tw >= current) {
        return 'Target weight must be less than current weight';
      }
      if (formData.goal === 'gain' && tw <= current) {
        return 'Target weight must be greater than current weight';
      }
      return null;
    }
    case 'timeframe_days': {
      if (formData.goal === 'maintain') return null;
      const td = Number(value);
      if (isNaN(td) || !Number.isInteger(td) || td <= 0) {
        return 'Timeframe must be a positive number of days';
      }
      return null;
    }
  }
}

function getVisibleSteps(
  formData: PartialOnboardingFormData,
  safetyGateShown: boolean,
): StepName[] {
  const steps: StepName[] = ALL_STEPS.slice(0, 5);
  if (formData.goal && formData.goal !== 'maintain') {
    steps.push('target_weight_kg', 'timeframe');
  }
  if (safetyGateShown) {
    steps.push('safety_gate');
  }
  steps.push('summary');
  return steps;
}

function buildFormData(partial: PartialOnboardingFormData): OnboardingFormData {
  const goal = partial.goal!;
  const result: OnboardingFormData = {
    gender: partial.gender!,
    age: partial.age!,
    height_cm: partial.height_cm!,
    current_weight_kg: partial.current_weight_kg!,
    goal,
  };
  if (goal !== 'maintain' && partial.target_weight_kg !== undefined) {
    result.target_weight_kg = partial.target_weight_kg;
  }
  if (goal !== 'maintain' && partial.timeframe_days !== undefined) {
    result.timeframe_days = partial.timeframe_days;
  }
  return result;
}

function handleGoNext(state: FormState): FormState {
  const field = STEP_FIELD[state.step];
  if (field) {
    const error = validateField(field, state.formData[field], state.formData);
    if (error !== null) {
      return { ...state, errors: { ...state.errors, [field]: error } };
    }
  }

  if (state.step === 'goal') {
    if (state.formData.goal === 'maintain') {
      const updated = { ...state.formData };
      delete updated.target_weight_kg;
      delete updated.timeframe_days;
      const fullData = buildFormData(updated);
      return {
        ...state,
        step: 'summary',
        formData: updated,
        calculationResults: calculateOnboardingResults(fullData),
      };
    }
    return { ...state, step: 'target_weight_kg' };
  }

  if (state.step === 'timeframe') {
    const currentWeight = state.formData.current_weight_kg!;
    const targetWeight = state.formData.target_weight_kg!;
    const timeframeDays = state.formData.timeframe_days!;
    const result = checkSafetyGate(
      state.formData.goal!,
      currentWeight,
      targetWeight,
      timeframeDays,
    );
    if (!result.passed) {
      return {
        ...state,
        step: 'safety_gate',
        safetyGateResult: result,
        safetyGateShown: true,
      };
    }
    const fullData = buildFormData(state.formData);
    return {
      ...state,
      step: 'summary',
      safetyGateResult: result,
      calculationResults: calculateOnboardingResults(fullData),
    };
  }

  const currentIdx = ALL_STEPS.indexOf(state.step);
  if (currentIdx === -1 || currentIdx >= ALL_STEPS.length - 1) return state;
  const next = ALL_STEPS[currentIdx + 1]!;
  if (next === 'target_weight_kg' && state.formData.goal === 'maintain') {
    return { ...state, step: 'summary' };
  }
  return { ...state, step: next };
}

function handleGoBack(state: FormState): FormState {
  const visible = getVisibleSteps(state.formData, state.safetyGateShown);
  const idx = visible.indexOf(state.step);
  if (idx <= 0) return state;
  const next = { ...state };
  if (state.step === 'summary') {
    next.calculationResults = null;
  }
  if (state.step === 'safety_gate') {
    next.safetyGateResult = null;
    next.safetyGateShown = false;
  }
  const prev = visible[idx - 1]!;
  next.step = prev;
  return next;
}

function handleAcceptSafeTimeframe(state: FormState): FormState {
  if (!state.safetyGateResult || state.safetyGateResult.passed) return state;
  const safeDays = state.safetyGateResult.safeDays;
  const updated: PartialOnboardingFormData = {
    ...state.formData,
    timeframe_days: safeDays,
  };
  const fullData = buildFormData(updated);
  return {
    ...state,
    step: 'summary',
    formData: updated,
    safetyGateResult: { passed: true },
    calculationResults: calculateOnboardingResults(fullData),
    safetyGateShown: false,
  };
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD': {
      const nextErrors = { ...state.errors };
      if (action.field in nextErrors) {
        delete nextErrors[action.field];
      }
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
        errors: nextErrors,
      };
    }
    case 'GO_NEXT':
      return handleGoNext(state);
    case 'GO_BACK':
      return handleGoBack(state);
    case 'ACCEPT_SAFE_TIMEFRAME':
      return handleAcceptSafeTimeframe(state);
    case 'REVISE_GOAL':
      return {
        ...state,
        safetyGateResult: null,
        safetyGateShown: false,
        step: 'goal',
      };
    case 'RESET':
      return { ...initialState };
  }
}

export function useOnboardingForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);

  const visibleSteps = useMemo(
    () => getVisibleSteps(state.formData, state.safetyGateShown),
    [state.formData.goal, state.safetyGateShown],
  );

  const stepIndex = visibleSteps.indexOf(state.step);
  const totalSteps = visibleSteps.length;
  const isSummaryReady = state.calculationResults !== null;

  const canAdvance = useMemo(() => {
    const field = STEP_FIELD[state.step];
    return field !== undefined
      && validateField(field, state.formData[field], state.formData) === null;
  }, [state.step, state.formData]);

  const setField = useCallback(
    (field: keyof OnboardingFormData, value: unknown) =>
      dispatch({ type: 'SET_FIELD', field, value }),
    [],
  );

  const goNext = useCallback(() => dispatch({ type: 'GO_NEXT' }), []);
  const goBack = useCallback(() => dispatch({ type: 'GO_BACK' }), []);
  const acceptSafeTimeframe = useCallback(
    () => dispatch({ type: 'ACCEPT_SAFE_TIMEFRAME' }), []);
  const reviseGoal = useCallback(
    () => dispatch({ type: 'REVISE_GOAL' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    step: state.step, stepIndex, totalSteps, formData: state.formData,
    errors: state.errors, safetyGateResult: state.safetyGateResult,
    calculationResults: state.calculationResults, isSummaryReady, canAdvance,
    setField, goNext, goBack, acceptSafeTimeframe, reviseGoal, reset,
  };
}
